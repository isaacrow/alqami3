const fs = require('fs');
const path = require('path');

const generateRDF = (id, titleAr, titleEn, creatorAr, date, extent, materialAr, materialEn, noteAr) => `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
         xmlns:bf="http://id.loc.gov/ontologies/bibframe/"
         xmlns:schema="http://schema.org/">
  <bf:Instance rdf:about="https://alqami.net/artifact/${id}">
    <bf:title>
      <bf:Title>
        <bf:mainTitle xml:lang="ar">${titleAr}</bf:mainTitle>
        <rdfs:label>${titleEn}</rdfs:label>
      </bf:Title>
    </bf:title>
    <bf:provisionActivity>
      <bf:ProvisionActivity>
        <bf:date>${date}</bf:date>
      </bf:ProvisionActivity>
    </bf:provisionActivity>
    <bf:extent>
      <bf:Extent>
        <rdfs:label xml:lang="ar">${extent}</rdfs:label>
      </bf:Extent>
    </bf:extent>
    <bf:material>
      <rdfs:label xml:lang="ar">${materialAr}</rdfs:label>
      <rdfs:label xml:lang="en">${materialEn}</rdfs:label>
    </bf:material>
    <bf:contribution>
      <bf:Contribution>
        <bf:agent>
          <bf:Agent>
            <rdfs:label xml:lang="ar">${creatorAr}</rdfs:label>
          </bf:Agent>
        </bf:agent>
      </bf:Contribution>
    </bf:contribution>
    <bf:note>
      <bf:Note>
        <rdfs:label xml:lang="ar">${noteAr}</rdfs:label>
      </bf:Note>
    </bf:note>
  </bf:Instance>
</rdf:RDF>`;

fs.mkdirSync('public', { recursive: true });

fs.writeFileSync('public/prayer_niche_mihrab.rdf', generateRDF(
  'mihrab',
  'محراب الصلاة', 'Prayer Niche (Mihrab)',
  'فنان إسلامي غير معروف', 'القرن الثالث عشر الميلادي',
  'قطعة معمارية كبيرة', 'خزف مزجج (قاشاني)', 'Glazed Ceramic (Kashani)',
  'محراب مزين بالزخارف الهندسية والنباتية والآيات القرآنية بالخط الكوفي والثلث. يستخدم لتحديد القبلة في المساجد.'
));

fs.writeFileSync('public/old-babylonian_cuneiform_tablet_s264.rdf', generateRDF(
  'cuneiform',
  'لوح مسماري بابلي قديم', 'Old Babylonian Cuneiform Tablet',
  'كاتب بابلي', 'العهد البابلي القديم (حوالي 1900-1600 ق.م)',
  'لوح طيني صغير', 'طين مشوي', 'Baked Clay',
  'لوح يحتوي على كتابات مسمارية توثق معاملات إدارية أو نصوص أدبية من الحضارة البابلية.'
));

fs.writeFileSync('public/babylonian_map_of_the_world_tablet_-_imago_mundi.rdf', generateRDF(
  'map',
  'خريطة بابل للعالم (إيماجو موندي)', 'Babylonian Map of the World (Imago Mundi)',
  'غير معروف', 'القرن السادس أو الخامس قبل الميلاد',
  '12.2 × 8.2 سم', 'طين', 'Clay',
  'تعتبر من أقدم الخرائط المعروفة في العالم، تظهر بابل في المركز وتحيط بها الأهوار والمحيط "نهر المرارة".'
));

fs.writeFileSync('public/stela_of_hammurabi_replica.rdf', generateRDF(
  'stela',
  'مسلة حمورابي', 'Stela of Hammurabi',
  'الإمبراطورية البابلية', 'حوالي 1750 ق.م',
  'طول 2.25 متر', 'حجر الديوريت الأسود', 'Black Diorite',
  'تحتوي على واحدة من أقدم وأكمل القوانين التشريعية المكتوبة في التاريخ البشري، منقوشة باللغة الأكادية.'
));

fs.writeFileSync('public/bowl.rdf', generateRDF(
  'bowl',
  'وعاء أثري', 'Ancient Bowl',
  'حرفي غير معروف', 'غير محدد',
  'متوسط الحجم', 'فخار', 'Pottery / Ceramic',
  'وعاء تاريخي يستخدم للأغراض اليومية، يعكس أسلوب صناعة الفخار في تلك الحقبة.'
));

fs.writeFileSync('public/model.rdf', generateRDF(
  'quran',
  'القرآن الكريم', 'The Holy Quran Manuscript',
  'حيدر علي (ناسخ)', '1009 هـ / 1600 م',
  '294 ورقة (15 سطراً)', 'ورق، حبر أسود، خط النسخ', 'Paper, Black Ink, Naskh Script',
  'النسخة مجدولة بعدة ألوان والصفحة الأولى والثانية مزخرفة. نسخت في حائر الإمام الحسين عليه السلام.'
));
