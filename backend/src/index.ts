// @rap/backend — PRODUCTION entrypoint (C3c). This is the ONLY esbuild input.
// It compiles in the production license public key; the dev key path under
// backend/dev/ is never imported here, so it is provably absent from the bundle.
import { PROD_LICENSE_PUBLIC_KEY } from './license/publicKey';
import { startServer } from './server';

void startServer({ licensePublicKey: PROD_LICENSE_PUBLIC_KEY });
