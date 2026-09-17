const tf = require('@tensorflow/tfjs');
const mobilenet = require('@tensorflow-models/mobilenet');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

async function getNormalizedEmbedding(model, imgPath) {
  const img = await loadImage(imgPath);
  const canvas = createCanvas(224, 224);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, 224, 224);

  return tf.tidy(() => {
    const rawTensor = model.infer(canvas, true).squeeze();
    const norm = rawTensor.norm();
    const normalized = rawTensor.div(norm);
    return Array.from(normalized.dataSync()).map(n => Math.round(n * 10000) / 10000);
  });
}

async function run() {
  console.log('Loading MobileNet for seed database generation...');
  const model = await mobilenet.load({ version: 2, alpha: 1.0 });

  const artifacts = [
    {
      id: "ART-002",
      identifier: "IPKSN:ART-002",
      title: "صندوق تحفة براغ (Prague Wooden Souvenir Box)",
      type: "artifact",
      description: "صندوق تذكاري خشبي من براغ يتميز بنقوش وزخارف جسر تشارلز وكلمة Praha بالخط القوطي، مع تعشيق خشبي يدوي وملصق السعر الأصلي.",
      collection: "مقتنيات القمي المعاصرة / Alqami Contemporary Collection",
      institution: "مؤسسة القمي للتراث المعرفي",
      date: "2024",
      materials: ["خشب الزان", "ورق ملصق", "حفر ليزر"],
      dimensions: { width: "8.5 cm", height: "11.2 cm", depth: "5.4 cm" },
      recognitionThreshold: 0.80,
      bibframe: {
        workUri: "http://example.org/work/1789642441889",
        instanceUri: "http://example.org/instance/1789642441889",
        rdfPath: "alqabasat.rdf",
        ttlPath: "alqabasat.ttl"
      },
      arModel: {
        glb: "model.glb",
        scale: 0.65
      },
      images: [
        { view: "front", file: "praha_front.jpg", label: "الجهة الأمامية (Praha Facade)" },
        { view: "back", file: "praha_back.jpg", label: "الجهة الخلفية (Price Sticker)" },
        { view: "left", file: "praha_side1.jpg", label: "الجانب الأيسر (Vertical Slot)" },
        { view: "right", file: "praha_side2.jpg", label: "الجانب الأيمن (Vertical Slot)" },
        { view: "top", file: "praha_top.jpg", label: "الجهة العلوية (Top Opening)" }
      ]
    },
    {
      id: "ART-001",
      identifier: "IPKSN:MS-001-QABASAT",
      title: "مخطوط القبسات — الميرداماد (Al-Qabasat Manuscript)",
      type: "manuscript",
      description: "نسخة أصلية مذهبة من كتاب القبسات للفيلسوف المتأله الميرداماد (توفي 1041 هـ)، بخط النستعليق ومجدولة بالذهب الخالص.",
      collection: "المخطوطات الفلسفية والكلامية النادرة",
      institution: "مكتبة مجلس الشورى : 4662، طهران",
      date: "1650 [1061 هـ]",
      materials: ["ورق يدوي", "حبر أسود", "ماء ذهب", "جلد أحمر"],
      dimensions: { extent: "344 ورقة", linesPerFolio: 18 },
      recognitionThreshold: 0.80,
      bibframe: {
        workUri: "http://example.org/work/1789642441889",
        instanceUri: "http://example.org/instance/1789642441889",
        rdfPath: "alqabasat.rdf",
        ttlPath: "alqabasat.ttl"
      },
      arModel: {
        glb: "model.glb",
        scale: 1.0
      },
      images: [
        { view: "front", file: "manuscript.jpg", label: "اللوحة الاستفتاحية المذهبة" }
      ]
    },
    {
      id: "ART-003",
      identifier: "IPKSN:ART-003-ZULFIQAR",
      title: "سيف ذو الفقار التاريخي (Zulfiqar Sword Artifact)",
      type: "weaponry",
      description: "تحفة رمزية مجسمة لسيف ذي الفقار بشفرته المزدوجة ونقوشه الكوفية التراثية ومقبضه الفولاذي الدمشقي.",
      collection: "متحف الأسلحة والتحف التاريخية الإسلامية",
      institution: "متحف القمي الرقمي",
      date: "القرن الـ 16 الميلادي",
      materials: ["فولاذ دمشقي", "فضة", "عاج"],
      dimensions: { length: "105 cm", weight: "1.4 kg" },
      recognitionThreshold: 0.80,
      bibframe: {
        ttlPath: "Zulfiqar_Sword.ttl"
      },
      arModel: {
        glb: "Zulfiqar_Sword.glb",
        scale: 1.0
      },
      images: [
        { view: "front", file: "hand.jpg", label: "شفرة السيف والمقبض" }
      ]
    },
    {
      id: "ART-004",
      identifier: "IPKSN:ART-004-SAQAKHANE",
      title: "طاسة سقاخانة برونزية (Saqakhane Sacred Bowl)",
      type: "metalwork",
      description: "وعاء برونزي تراثي محفور بالأدعية والرموز الروحية التقليدية من العهد الصفوي المتأخر.",
      collection: "مجموعة الفنون والتحف المعدنية",
      institution: "متحف الفنون التراثية",
      date: "القرن الـ 17 الميلادي",
      materials: ["برونز مصبوب", "نقش بارز"],
      dimensions: { diameter: "18.5 cm", height: "7 cm" },
      recognitionThreshold: 0.80,
      bibframe: {
        ttlPath: "saqakhane_bowl.ttl"
      },
      arModel: {
        glb: "saqakhane_bowl.glb",
        scale: 1.0
      },
      images: [
        { view: "angle", file: "alqami_artifact.jpg", label: "الجسم الخارجي والنقوش" }
      ]
    },
    {
      id: "ART-005",
      identifier: "IPKSN:MS-005-KUFIC",
      title: "رق مصحف كوفي أثري (Early Kufic Quran Folio)",
      type: "manuscript",
      description: "ورقة رق أثرية مكتوبة بالخط الكوفي الحجازي المبكر مع علامات التنقيط والتشكيل الحمراء والذهبية.",
      collection: "مجموعة المصاحف الشريفة المبكرة",
      institution: "المكتبة الوطنية للتراث",
      date: "القرن الـ 8 الميلادي [القرن 2 هـ]",
      materials: ["رق غزال", "حبر كربوني", "صبغ أحمر طبيعي"],
      dimensions: { extent: "رق مفرد", dimensions: "24 x 32 cm" },
      recognitionThreshold: 0.80,
      bibframe: {
        ttlPath: "kufic.ttl"
      },
      arModel: {
        glb: "model.glb",
        scale: 1.0
      },
      images: [
        { view: "front", file: "kufic.jpg", label: "صفحة الرق الكوفي" }
      ]
    }
  ];

  for (const artifact of artifacts) {
    console.log(`Extracting embeddings for ${artifact.id} (${artifact.title})...`);
    artifact.embeddings = [];
    for (const imgInfo of artifact.images) {
      const fullPath = path.resolve(__dirname, '../public', imgInfo.file);
      if (fs.existsSync(fullPath)) {
        const vector = await getNormalizedEmbedding(model, fullPath);
        artifact.embeddings.push({
          view: imgInfo.view,
          label: imgInfo.label,
          imageFile: imgInfo.file,
          vector: vector
        });
        console.log(`  ✓ Extracted view [${imgInfo.view}] vector (length: ${vector.length})`);
      } else {
        console.warn(`  ✗ File not found: ${fullPath}`);
      }
    }
  }

  const outDir = path.resolve(__dirname, '../public/data');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, 'seed-artifacts.json');
  fs.writeFileSync(outPath, JSON.stringify(artifacts, null, 2));
  console.log(`\nSuccessfully generated seed database at ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
}

run().catch(console.error);
