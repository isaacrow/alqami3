import { CompilerBase } from '../node_modules/mind-ar/src/image-target/compiler-base.js';
import { buildTrackingImageList } from '../node_modules/mind-ar/src/image-target/image-list.js';
import { extractTrackingFeatures } from '../node_modules/mind-ar/src/image-target/tracker/extract-utils.js';
import '../node_modules/mind-ar/src/image-target/detector/kernels/cpu/index.js';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class NodeCompiler extends CompilerBase {
  createProcessCanvas(img) {
    const canvas = createCanvas(img.width, img.height);
    return canvas;
  }

  compileTrack({ progressCallback, targetImages, basePercent }) {
    return new Promise((resolve) => {
      const percentPerImage = (100 - basePercent) / targetImages.length;
      let percent = 0;
      const list = [];
      for (let i = 0; i < targetImages.length; i++) {
        const targetImage = targetImages[i];
        const imageList = buildTrackingImageList(targetImage);
        const percentPerAction = percentPerImage / imageList.length;

        const trackingData = extractTrackingFeatures(imageList, (index) => {
          percent += percentPerAction;
          if (progressCallback) {
            progressCallback(basePercent + percent);
          }
        });
        list.push(trackingData);
      }
      resolve(list);
    });
  }
}

async function compileManuscript() {
  const img1Path = path.resolve(__dirname, '../public/manuscript.jpg');
  const img2Path = path.resolve(__dirname, '../public/quran.jpg');
  const img3Path = path.resolve(__dirname, '../public/kufic.jpg');
  const img4Path = path.resolve(__dirname, '../public/hand.jpg');
  const img5Path = path.resolve(__dirname, '../public/alqami_artifact.jpg');
  const outputDir = path.resolve(__dirname, '../public/targets');
  const outputPath = path.join(outputDir, 'manuscript.mind');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Loading image 1...`);
  const image1 = await loadImage(img1Path);
  console.log(`Loading image 2...`);
  const image2 = await loadImage(img2Path);
  console.log(`Loading image 3...`);
  const image3 = await loadImage(img3Path);
  console.log(`Loading image 4...`);
  const image4 = await loadImage(img4Path);
  console.log(`Loading image 5...`);
  const image5 = await loadImage(img5Path);

  const compiler = new NodeCompiler();
  console.log('Compiling target images into .mind format...');

  await compiler.compileImageTargets([image1, image2, image3, image4, image5], (progress) => {
    process.stdout.write(`\rProgress: ${progress.toFixed(1)}%`);
  });

  console.log('\nCompilation finished. Exporting buffer...');
  const buffer = compiler.exportData();

  fs.writeFileSync(outputPath, Buffer.from(buffer));
  console.log(`Successfully saved target to ${outputPath} (${(buffer.byteLength / 1024).toFixed(1)} KB)`);
}

compileManuscript().catch((err) => {
  console.error('Error compiling target:', err);
  process.exit(1);
});
