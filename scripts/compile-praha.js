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
    return createCanvas(img.width, img.height);
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

async function resizeToCanvas(imgPath, targetWidth = 480) {
  const img = await loadImage(imgPath);
  const scale = targetWidth / img.width;
  const h = Math.round(img.height * scale);
  const canvas = createCanvas(targetWidth, h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, targetWidth, h);
  return canvas;
}

async function compilePrahaBox() {
  const SIDES = [
    'praha_front.jpg',
    'praha_back.jpg',
    'praha_side1.jpg',
    'praha_side2.jpg',
    'praha_top.jpg'
  ];

  const outputDir = path.resolve(__dirname, '../public/targets');
  const outputPath = path.join(outputDir, 'praha_box.mind');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('Loading and resizing 5 sides of the box...');
  const targetImages = [];
  for (let i = 0; i < SIDES.length; i++) {
    const fullPath = path.resolve(__dirname, '../public', SIDES[i]);
    const canvas = await resizeToCanvas(fullPath, 480);
    targetImages.push(canvas);
    console.log(`Loaded side ${i}: ${SIDES[i]} (${canvas.width}x${canvas.height})`);
  }

  const compiler = new NodeCompiler();
  console.log('Compiling 5 sides into praha_box.mind...');

  await compiler.compileImageTargets(targetImages, (progress) => {
    process.stdout.write(`\rProgress: ${progress.toFixed(1)}%`);
  });

  console.log('\nCompilation completed. Exporting .mind buffer...');
  const buffer = compiler.exportData();

  fs.writeFileSync(outputPath, Buffer.from(buffer));
  console.log(`Successfully saved target to ${outputPath} (${(buffer.byteLength / 1024).toFixed(1)} KB)`);
}

compilePrahaBox().catch((err) => {
  console.error('Error compiling praha_box.mind:', err);
  process.exit(1);
});
