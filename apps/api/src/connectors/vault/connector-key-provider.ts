/**
 * Arden.AS API — provider de chaves do cofre (ARDEN-BE-006.4).
 *
 * Lê a master key e o keyring da CONFIG (nunca do banco, nunca versionado). Cifra
 * com a chave corrente; decifra com a versão registrada. Falha se a versão antiga
 * não estiver disponível. NUNCA imprime material de chave.
 */

import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from '../../config/config.module';
import type { AppConfig } from '../../config/env.schema';

export interface KeyMaterial {
  version: string;
  key: Buffer;
}

@Injectable()
export class ConnectorKeyProvider {
  private readonly currentVersion: string;
  private readonly keyring = new Map<string, Buffer>();

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    this.currentVersion = config.CONNECTOR_KEY_VERSION;
    if (config.CONNECTOR_MASTER_KEY) {
      this.keyring.set(this.currentVersion, this.decode(config.CONNECTOR_MASTER_KEY));
    }
    if (config.CONNECTOR_KEYRING_JSON) {
      const parsed = JSON.parse(config.CONNECTOR_KEYRING_JSON) as Record<string, string>;
      for (const [version, b64] of Object.entries(parsed)) this.keyring.set(version, this.decode(b64));
    }
  }

  private decode(b64: string): Buffer {
    const buf = Buffer.from(b64, 'base64');
    if (buf.length !== 32) throw new Error('master key material must be 32 bytes');
    return buf;
  }

  getCurrentKey(): KeyMaterial {
    const key = this.keyring.get(this.currentVersion);
    if (!key) throw new Error('vault current key unavailable');
    return { version: this.currentVersion, key };
  }

  /** Chave por versão (para decifrar versões antigas). Falha se indisponível. */
  getKey(version: string): KeyMaterial {
    const key = this.keyring.get(version);
    if (!key) throw new Error(`vault key version unavailable: ${version}`);
    return { version, key };
  }
}
