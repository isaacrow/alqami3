// MobileNet Visual Feature Extractor (1024-D Embeddings) for Alqami
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as tf from '@tensorflow/tfjs';

export class FeatureExtractor {
  constructor() {
    this.model = null;
    this.isLoading = false;
    this.isReady = false;
  }

  async init() {
    if (this.isReady && this.model) return true;
    if (this.isLoading) {
      while (this.isLoading) {
        await new Promise(r => setTimeout(r, 50));
      }
      return this.isReady;
    }

    this.isLoading = true;
    try {
      console.log('Loading MobileNet Feature Extraction Model (TF.js)...');
      // Load MobileNet v2 with alpha 1.0 for high visual fidelity embedding vectors
      this.model = await mobilenet.load({
        version: 2,
        alpha: 1.0
      });
      this.isReady = true;
      console.log('MobileNet Feature Extractor loaded successfully!');
      return true;
    } catch (err) {
      console.error('Failed to load MobileNet model:', err);
      this.isReady = false;
      throw err;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Extracts a normalized 1024-D embedding from an HTMLImageElement, HTMLCanvasElement, or HTMLVideoElement
   * @param {HTMLImageElement|HTMLCanvasElement|HTMLVideoElement} inputElement 
   * @returns {Promise<Float32Array>} 1024-D normalized visual feature vector
   */
  async extractEmbedding(inputElement) {
    if (!this.isReady || !this.model) {
      await this.init();
    }

    return tf.tidy(() => {
      // model.infer(input, true) returns the pre-classification feature activation tensor (1024-D)
      const embeddingTensor = this.model.infer(inputElement, true);
      
      // Squeeze 2D/4D tensor into 1D (shape: [1024])
      const squeezed = embeddingTensor.squeeze();
      
      // Compute L2 norm for unit sphere projection
      const norm = squeezed.norm();
      const normalizedTensor = squeezed.div(norm);
      
      // Read raw Float32Array values
      return new Float32Array(normalizedTensor.dataSync());
    });
  }

  /**
   * Crops a region of interest (ROI) from a source video/canvas and extracts embedding
   * @param {HTMLVideoElement|HTMLCanvasElement} source 
   * @param {Object} roi - { x, y, width, height }
   * @returns {Promise<Float32Array>}
   */
  async extractFromCrop(source, roi) {
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = 224;
    cropCanvas.height = 224;
    const ctx = cropCanvas.getContext('2d');
    
    ctx.drawImage(
      source,
      roi.x, roi.y, roi.width, roi.height,
      0, 0, 224, 224
    );

    return this.extractEmbedding(cropCanvas);
  }
}
