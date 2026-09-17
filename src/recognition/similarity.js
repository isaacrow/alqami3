// Vector Mathematics and Cosine Similarity Metrics for Alqami Artifact Recognition

export class SimilarityMetrics {
  /**
   * Computes the dot product of two vectors
   */
  static dotProduct(a, b) {
    let sum = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  }

  /**
   * Computes L2 magnitude (norm) of a vector
   */
  static magnitude(a) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * a[i];
    }
    return Math.sqrt(sum);
  }

  /**
   * Computes normalized cosine similarity: range [-1, 1] mapped or clamped to [0, 1]
   */
  static cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
    const dot = this.dotProduct(vecA, vecB);
    const magA = this.magnitude(vecA);
    const magB = this.magnitude(vecB);
    if (magA === 0 || magB === 0) return 0;
    const sim = dot / (magA * magB);
    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, sim));
  }

  /**
   * Compares a query embedding against the entire multi-view artifact database
   * @param {Float32Array|number[]} queryEmbedding - 1024-D vector from camera
   * @param {Array} artifacts - Array of registered artifact objects
   * @returns {Object} { bestMatch, candidates, topScore }
   */
  static evaluate(queryEmbedding, artifacts) {
    if (!queryEmbedding || !artifacts || artifacts.length === 0) {
      return {
        bestMatch: null,
        candidates: [],
        topScore: 0
      };
    }

    const candidateScores = [];

    for (const artifact of artifacts) {
      if (!artifact.embeddings || artifact.embeddings.length === 0) continue;

      let highestScoreForArtifact = 0;
      let bestViewForArtifact = 'general';

      for (const ref of artifact.embeddings) {
        if (!ref.vector || ref.vector.length === 0) continue;
        const sim = this.cosineSimilarity(queryEmbedding, ref.vector);
        if (sim > highestScoreForArtifact) {
          highestScoreForArtifact = sim;
          bestViewForArtifact = ref.view || 'general';
        }
      }

      if (highestScoreForArtifact > 0) {
        candidateScores.push({
          artifact: artifact,
          id: artifact.id,
          title: artifact.title,
          similarity: highestScoreForArtifact,
          matchedView: bestViewForArtifact
        });
      }
    }

    // Sort descending by similarity
    candidateScores.sort((a, b) => b.similarity - a.similarity);

    const bestMatch = candidateScores.length > 0 ? candidateScores[0] : null;
    const topScore = bestMatch ? bestMatch.similarity : 0;

    return {
      bestMatch: bestMatch,
      candidates: candidateScores.slice(0, 5), // Top 5 candidates for debugging/inspector
      topScore: topScore
    };
  }
}
