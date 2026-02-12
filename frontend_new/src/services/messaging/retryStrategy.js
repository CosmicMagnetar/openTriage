/**
 * Retry Strategy with Exponential Backoff
 * 
 * Implements a robust retry mechanism for WebSocket connections with:
 * - Exponential backoff
 * - Jitter to prevent thundering herd
 * - Maximum retry limits
 * - Configurable delays
 */

const DEFAULT_CONFIG = {
  baseDelay: 1000,        // 1 second
  maxDelay: 30000,        // 30 seconds
  maxRetries: 5,
  backoffMultiplier: 2,
  jitterPercent: 0.2,     // ±20%
};

export class RetryStrategy {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.retryCount = 0;
    this.isActive = false;
    this.currentTimeout = null;
  }

  /**
   * Calculate delay for the next retry attempt
   * Uses exponential backoff with jitter
   */
  getNextDelay() {
    const { baseDelay, maxDelay, backoffMultiplier, jitterPercent } = this.config;
    
    // Exponential backoff: baseDelay * (multiplier ^ retryCount)
    const exponentialDelay = baseDelay * Math.pow(backoffMultiplier, this.retryCount);
    
    // Cap at maxDelay
    const cappedDelay = Math.min(exponentialDelay, maxDelay);
    
    // Add jitter: ±jitterPercent
    const jitter = cappedDelay * jitterPercent * (Math.random() * 2 - 1);
    const finalDelay = Math.max(0, cappedDelay + jitter);
    
    return Math.round(finalDelay);
  }

  /**
   * Check if we can retry
   */
  canRetry() {
    return this.retryCount < this.config.maxRetries;
  }

  /**
   * Execute a retry attempt with exponential backoff
   * 
   * @param {Function} callback - Function to execute on retry
   * @param {Object} options - Options for this retry
   * @returns {Promise} - Resolves when retry is attempted or max retries reached
   */
  retry(callback, options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.canRetry()) {
        const error = new Error(`Max retries (${this.config.maxRetries}) exceeded`);
        error.code = 'MAX_RETRIES_EXCEEDED';
        reject(error);
        return;
      }

      const delay = options.delay !== undefined ? options.delay : this.getNextDelay();
      this.retryCount++;
      this.isActive = true;

      console.log(
        `[RetryStrategy] Retry attempt ${this.retryCount}/${this.config.maxRetries} ` +
        `in ${Math.round(delay / 1000)}s`
      );

      this.currentTimeout = setTimeout(async () => {
        try {
          const result = await callback();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
  }

  /**
   * Reset retry counter (call on successful connection)
   */
  reset() {
    this.retryCount = 0;
    this.isActive = false;
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }
  }

  /**
   * Cancel current retry attempt
   */
  cancel() {
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }
    this.isActive = false;
  }

  /**
   * Get current retry status
   */
  getStatus() {
    return {
      retryCount: this.retryCount,
      maxRetries: this.config.maxRetries,
      canRetry: this.canRetry(),
      isActive: this.isActive,
      nextDelay: this.canRetry() ? this.getNextDelay() : null,
    };
  }
}

/**
 * Create a retry strategy with custom config
 */
export function createRetryStrategy(config) {
  return new RetryStrategy(config);
}

/**
 * Convenience function for simple retry logic
 * 
 * @param {Function} fn - Async function to retry
 * @param {Object} config - Retry configuration
 * @returns {Promise} - Resolves with function result or rejects after max retries
 */
export async function withRetry(fn, config = {}) {
  const strategy = new RetryStrategy(config);
  
  const attempt = async () => {
    try {
      const result = await fn();
      strategy.reset();
      return result;
    } catch (error) {
      if (strategy.canRetry()) {
        return strategy.retry(attempt);
      }
      throw error;
    }
  };
  
  return attempt();
}

export default RetryStrategy;
