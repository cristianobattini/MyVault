/**
 * RealmDataService — secure export / import for MyVault
 *
 * Format v2 security properties:
 *  - Key derivation : PBKDF2-SHA256, 50 000 iterations, 256-bit salt
 *  - Encryption     : AES-256-CBC
 *  - Authentication : HMAC-SHA256 (Encrypt-then-MAC over v|salt|iv|ct)
 *  - Two independent 256-bit keys derived in one PBKDF2 call (enc + mac)
 *  - All random material generated via expo-crypto (native CSPRNG)
 */

import Realm, { BSON } from 'realm';
import CryptoJS from 'crypto-js';
import * as FileSystem from 'expo-file-system';
import { Credential } from '@/models/Credential';
import { Tag } from '@/models/Tag';
import { getRandomBytesAsync } from 'expo-crypto';

// ─── Security constants ───────────────────────────────────────────────────────

const FORMAT_VERSION = 2;
const PBKDF2_ITERATIONS = 50_000; // 50× the old value; SHA-256 hasher
const SALT_BYTES = 32;            // 256-bit salt
const IV_BYTES = 16;              // 128-bit IV for AES-CBC

// ─── Types ────────────────────────────────────────────────────────────────────

interface EncryptedPackage {
  v: number;          // format version (must equal FORMAT_VERSION)
  salt: string;       // hex, 64 chars — 256-bit PBKDF2 salt
  iv: string;         // hex, 32 chars — 128-bit AES IV
  ct: string;         // base64 — AES-256-CBC ciphertext
  mac: string;        // hex — HMAC-SHA256(macKey, "v|salt|iv|ct")
  exportedAt: string; // ISO-8601 timestamp
}

// ─── Crypto helpers ───────────────────────────────────────────────────────────

/** Generate `bytes` cryptographically secure random bytes as a lowercase hex string. */
async function randomHex(bytes: number): Promise<string> {
  const arr = await getRandomBytesAsync(bytes);
  return Array.from(arr)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Derive two independent 256-bit keys from `password` + `saltHex` using
 * PBKDF2-SHA256 with PBKDF2_ITERATIONS iterations.
 *
 * A single 512-bit PBKDF2 output is split into:
 *   encKey — first 256 bits, used for AES-256-CBC
 *   macKey — last 256 bits, used for HMAC-SHA256
 */
async function deriveKeys(
  password: string,
  saltHex: string,
): Promise<{ encKey: CryptoJS.lib.WordArray; macKey: CryptoJS.lib.WordArray }> {
  const salt = CryptoJS.enc.Hex.parse(saltHex);

  // 512 bits = keySize of 16 (words of 32 bits each)
  const derived = CryptoJS.PBKDF2(password, salt, {
    keySize: 512 / 32,
    iterations: PBKDF2_ITERATIONS,
    hasher: CryptoJS.algo.SHA256,
  });

  const hex = derived.toString(CryptoJS.enc.Hex); // 128 hex chars = 512 bits
  return {
    encKey: CryptoJS.enc.Hex.parse(hex.slice(0, 64)),  // first 256 bits
    macKey: CryptoJS.enc.Hex.parse(hex.slice(64, 128)), // last 256 bits
  };
}

/** Compute the MAC input string — deterministic canonical form. */
function macInput(v: number, salt: string, iv: string, ct: string): string {
  return `${v}|${salt}|${iv}|${ct}`;
}

// ─── Realm serialisation ──────────────────────────────────────────────────────

function realmObjectToPlain(obj: any): any {
  console.log('Serialising Realm object:', obj);
  const plain: any = {};
  Object.keys(obj.objectSchema().properties).forEach(prop => {
    if (prop === '_id') {
      plain[prop] = obj[prop].toHexString();
    } else if (obj[prop] instanceof Date) {
      plain[prop] = obj[prop].toISOString();
    } else if (Array.isArray(obj[prop])) {
      plain[prop] = obj[prop].map((item: any) => item._id.toHexString());
    } else {
      plain[prop] = obj[prop];
    }
  });
  return plain;
}

// ─── Service ──────────────────────────────────────────────────────────────────

class RealmDataService {
  /**
   * Export all credentials + tags to an AES-256-CBC + HMAC-SHA256 encrypted
   * file and return its local URI (ready to pass to expo-sharing).
   */
  static async exportData(realm: Realm, password: string, fileName?: string): Promise<string> {
    // 1. Serialise Realm data
    const payload = JSON.stringify({
      credentials: Array.from(realm.objects<Credential>('Credential')).map(realmObjectToPlain),
      tags: Array.from(realm.objects<Tag>('Tag')).map(realmObjectToPlain),
    });

    // 2. Generate fresh random salt and IV (native CSPRNG via expo-crypto)
    const saltHex = await randomHex(SALT_BYTES);
    const ivHex   = await randomHex(IV_BYTES);

    // 3. Derive encryption + authentication keys
    const { encKey, macKey } = await deriveKeys(password, saltHex);

    // 4. Encrypt with AES-256-CBC
    const iv        = CryptoJS.enc.Hex.parse(ivHex);
    const encrypted = CryptoJS.AES.encrypt(payload, encKey, {
      iv,
      mode:    CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    const ct = encrypted.toString(); // base64

    // 5. Authenticate — HMAC-SHA256 over the canonical "v|salt|iv|ct" string
    const mac = CryptoJS.HmacSHA256(
      macInput(FORMAT_VERSION, saltHex, ivHex, ct),
      macKey,
    ).toString(CryptoJS.enc.Hex);

    // 6. Assemble encrypted package
    const pkg: EncryptedPackage = {
      v:          FORMAT_VERSION,
      salt:       saltHex,
      iv:         ivHex,
      ct,
      mac,
      exportedAt: new Date().toISOString(),
    };

    // 7. Write to document directory and return URI
    const date     = new Date().toISOString().split('T')[0];
    const name     = fileName?.trim() || `myvault_${date}`;
    const fileUri  = `${FileSystem.documentDirectory}${name}.mvault`;

    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(pkg), {
      encoding: FileSystem.EncodingType.UTF8,
    });

    return fileUri;
  }

  /**
   * Decrypt and import a .mvault backup file.
   * Throws a human-readable error on wrong password, tampering, or bad format.
   */
  static async importData(realm: Realm, fileUri: string, password: string): Promise<void> {
    // 1. Read and parse
    const raw = await FileSystem.readAsStringAsync(fileUri);
    let pkg: EncryptedPackage;
    try {
      pkg = JSON.parse(raw);
    } catch {
      throw new Error('The file is not a valid MyVault backup.');
    }

    if (pkg.v !== FORMAT_VERSION) {
      throw new Error(
        `Unsupported backup format (v${pkg.v}). Please use the latest version of MyVault.`,
      );
    }

    // 2. Derive keys from the password and the file's own salt
    const { encKey, macKey } = await deriveKeys(password, pkg.salt);

    // 3. Verify HMAC before decrypting (authentication first)
    const expectedMac = CryptoJS.HmacSHA256(
      macInput(FORMAT_VERSION, pkg.salt, pkg.iv, pkg.ct),
      macKey,
    ).toString(CryptoJS.enc.Hex);

    if (expectedMac !== pkg.mac) {
      // Same error for wrong password and tampered file — do not distinguish
      throw new Error('Wrong password or corrupted backup file.');
    }

    // 4. Decrypt
    const iv        = CryptoJS.enc.Hex.parse(pkg.iv);
    const decrypted = CryptoJS.AES.decrypt(pkg.ct, encKey, {
      iv,
      mode:    CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    const payload = decrypted.toString(CryptoJS.enc.Utf8);

    if (!payload) {
      throw new Error('Decryption produced no output — the file may be corrupted.');
    }

    let data: { credentials: any[]; tags: any[] };
    try {
      data = JSON.parse(payload);
    } catch {
      throw new Error('Decrypted data is malformed.');
    }

    // 5. Write to Realm
    realm.write(() => {
      // Import tags first (credentials reference them)
      const tagMap = new Map<string, Tag>();

      data.tags.forEach((tagData: any) => {
        const tag = realm.create<Tag>('Tag', {
          _id:      new BSON.ObjectId(tagData._id),
          name:     tagData.name,
          colorHex: tagData.colorHex,
          iconName: tagData.iconName,
        });
        tagMap.set(tagData._id, tag);
      });

      data.credentials.forEach((credData: any) => {
        const credential = realm.create<Credential>('Credential', {
          _id:        new BSON.ObjectId(credData._id),
          title:      credData.title,
          username:   credData.username,
          password:   credData.password,
          url:        credData.url,
          notes:      credData.notes,
          createdAt:  new Date(credData.createdAt),
          updatedAt:  new Date(credData.updatedAt),
          isFavorite: credData.isFavorite,
          isArchived: credData.isArchived,
        });

        if (credData.tags?.length > 0) {
          credData.tags.forEach((tagId: string) => {
            tagMap.get(tagId)?.credentials.push(credential);
          });
        }
      });
    });
  }
}

export default RealmDataService;
