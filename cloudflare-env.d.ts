declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    MODEL_API_KEY?: string;
    MODEL_BASE_URL?: string;
    MODEL_NAME?: string;
  }
}
