// Temporal Stability Filter for Closed-Set Artifact Recognition

export class TemporalStabilityFilter {
  constructor(options = {}) {
    this.requiredConsecutiveFrames = options.requiredConsecutiveFrames || 3;
    this.debounceMs = options.debounceMs || 400; // ms
    this.lossGraceMs = options.lossGraceMs || 800; // time to wait before declaring lost
    
    this.candidateHistory = [];
    this.lastConfirmedCandidate = null;
    this.lastDetectionTimestamp = 0;
    this.candidateFirstSeenTimestamp = 0;
    this.currentConsistentCount = 0;
  }

  /**
   * Process a new detection observation
   * @param {Object|null} currentBestCandidate - { id, title, similarity, matchedView } or null if unknown
   * @param {number} timestamp - current timestamp
   * @returns {Object} { status: 'CONFIRMED' | 'CANDIDATE' | 'UNKNOWN' | 'LOST', candidate, stabilityScore }
   */
  process(currentBestCandidate, timestamp = performance.now()) {
    if (!currentBestCandidate) {
      // No candidate passed threshold
      const elapsedSinceDetection = timestamp - this.lastDetectionTimestamp;
      if (this.lastConfirmedCandidate && elapsedSinceDetection < this.lossGraceMs) {
        return {
          status: 'CONFIRMED',
          candidate: this.lastConfirmedCandidate,
          stabilityScore: Math.max(0, 1 - (elapsedSinceDetection / this.lossGraceMs))
        };
      }

      this.currentConsistentCount = 0;
      this.lastConfirmedCandidate = null;
      return {
        status: 'UNKNOWN',
        candidate: null,
        stabilityScore: 0
      };
    }

    // A candidate passed threshold
    const currId = currentBestCandidate.id;
    const lastId = this.lastCandidateId;

    if (currId === lastId) {
      this.currentConsistentCount++;
      const durationSeen = timestamp - this.candidateFirstSeenTimestamp;

      // Check if requirement met
      if (this.currentConsistentCount >= this.requiredConsecutiveFrames || durationSeen >= this.debounceMs) {
        this.lastConfirmedCandidate = currentBestCandidate;
        this.lastDetectionTimestamp = timestamp;

        return {
          status: 'CONFIRMED',
          candidate: currentBestCandidate,
          stabilityScore: Math.min(1.0, this.currentConsistentCount / this.requiredConsecutiveFrames)
        };
      } else {
        return {
          status: 'CANDIDATE',
          candidate: currentBestCandidate,
          stabilityScore: this.currentConsistentCount / this.requiredConsecutiveFrames
        };
      }
    } else {
      // New candidate observed, start fresh counter
      this.lastCandidateId = currId;
      this.candidateFirstSeenTimestamp = timestamp;
      this.lastDetectionTimestamp = timestamp;
      this.currentConsistentCount = 1;

      return {
        status: 'CANDIDATE',
        candidate: currentBestCandidate,
        stabilityScore: 1 / this.requiredConsecutiveFrames
      };
    }
  }

  reset() {
    this.candidateHistory = [];
    this.lastConfirmedCandidate = null;
    this.lastCandidateId = null;
    this.currentConsistentCount = 0;
    this.lastDetectionTimestamp = 0;
    this.candidateFirstSeenTimestamp = 0;
  }
}
