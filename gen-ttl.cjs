const fs = require('fs');

const generateTTL = (id, titleAr, titleEn, creatorAr, date, extent, materialAr, materialEn, noteAr) => `@prefix dc: <http://purl.org/dc/elements/1.1/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix schema: <http://schema.org/> .
@prefix ms: <http://example.org/manuscript/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

<https://alqami.net/artifact/${id}>
    a schema:CreativeWork ;
    dc:title "${titleAr}"@ar ;
    dc:title "${titleEn}"@en ;
    dc:creator "${creatorAr}"@ar ;
    dc:date "${date}" ;
    schema:material "${materialAr}"@ar ;
    schema:material "${materialEn}"@en ;
    ms:transcriptionArabic """${noteAr}"""@ar ;
    ms:translationEnglish """Description loaded."""@en ;
    schema:extent "${extent}"@ar .
`;

fs.writeFileSync('public/prayer_niche_mihrab.ttl', generateTTL(
  'mihrab',
  'محراب الصلاة', 'Prayer Niche (Mihrab)',
  'فنان إسلامي غير معروف', 'القرن الثالث عشر الميلادي',
  'قطعة معمارية كبيرة', 'خزف مزجج (قاشاني)', 'Glazed Ceramic (Kashani)',
  'محراب مزين بالزخارف الهندسية والنباتية والآيات القرآنية بالخط الكوفي والثلث. يستخدم لتحديد القبلة في المساجد.'
));

fs.writeFileSync('public/old-babylonian_cuneiform_tablet_s264.ttl', generateTTL(
  'cuneiform',
  'لوح مسماري بابلي قديم', 'Old Babylonian Cuneiform Tablet',
  'كاتب بابلي', 'العهد البابلي القديم (حوالي 1900-1600 ق.م)',
  'لوح طيني صغير', 'طين مشوي', 'Baked Clay',
  'لوح يحتوي على كتابات مسمارية توثق معاملات إدارية أو نصوص أدبية من الحضارة البابلية.'
));

fs.writeFileSync('public/babylonian_map_of_the_world_tablet_-_imago_mundi.ttl', generateTTL(
  'map',
  'خريطة بابل للعالم (إيماجو موندي)', 'Babylonian Map of the World (Imago Mundi)',
  'غير معروف', 'القرن السادس أو الخامس قبل الميلاد',
  '12.2 × 8.2 سم', 'طين', 'Clay',
  'تعتبر من أقدم الخرائط المعروفة في العالم، تظهر بابل في المركز وتحيط بها الأهوار والمحيط "نهر المرارة".'
));

fs.writeFileSync('public/stela_of_hammurabi_replica.ttl', generateTTL(
  'stela',
  'مسلة حمورابي', 'Stela of Hammurabi',
  'الإمبراطورية البابلية', 'حوالي 1750 ق.م',
  'طول 2.25 متر', 'حجر الديوريت الأسود', 'Black Diorite',
  'تحتوي على واحدة من أقدم وأكمل القوانين التشريعية المكتوبة في التاريخ البشري، منقوشة باللغة الأكادية.'
));

fs.writeFileSync('public/bowl.ttl', generateTTL(
  'bowl',
  'وعاء أثري', 'Ancient Bowl',
  'حرفي غير معروف', 'غير محدد',
  'متوسط الحجم', 'فخار', 'Pottery / Ceramic',
  'وعاء تاريخي يستخدم للأغراض اليومية، يعكس أسلوب صناعة الفخار في تلك الحقبة.'
));

fs.writeFileSync('public/model.ttl', generateTTL(
  'quran',
  'القرآن الكريم', 'The Holy Quran Manuscript',
  'حيدر علي (ناسخ)', '1009 هـ / 1600 م',
  '294 ورقة (15 سطراً)', 'ورق، حبر أسود، خط النسخ', 'Paper, Black Ink, Naskh Script',
  'النسخة مجدولة بعدة ألوان والصفحة الأولى والثانية مزخرفة. نسخت في حائر الإمام الحسين عليه السلام.'
));
