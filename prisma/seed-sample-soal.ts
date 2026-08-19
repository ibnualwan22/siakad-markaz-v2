import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ===== 19 Tipe Soal =====
const ALL_TIPE_SOAL = [
  "PG", "PG_MULTI", "BENAR_SALAH", "ISIAN_SAMPING", "ISIAN_BAWAH",
  "MUFRODAT", "ESSAY_SINGKAT", "ESSAY_PANJANG", "MENJODOHKAN", "MENGURUTKAN",
  "KITABAH", "DRAG_KATEGORI", "PARAGRAF_RUMPANG", "IDENTIFIKASI_KESALAHAN",
  "TABEL_TASRIF", "SUSUN_HURUF", "DRAG_TO_BLANK", "STABILO_SYNTAX", "JARING_RELASI"
];

// ===== Helper: buat data soal sesuai tipe =====
function buildSoalData(tipe: string, nomor: number): {
  pertanyaan: string;
  opsiList?: { teks: string; isCorrect: boolean }[];
  kunciJawaban?: string;
  dataTambahan?: any;
} {
  switch (tipe) {
    // ── PG (Pilihan Ganda) ──────────────────────────────
    case "PG":
      return [
        {
          pertanyaan: "ما معنى كلمة \"كِتَابٌ\"؟",
          opsiList: [
            { teks: "كتاب (Book)", isCorrect: true },
            { teks: "قلم (Pen)", isCorrect: false },
            { teks: "بيت (House)", isCorrect: false },
            { teks: "باب (Door)", isCorrect: false },
          ],
        },
        {
          pertanyaan: "ما جمع كلمة \"طَالِبٌ\"؟",
          opsiList: [
            { teks: "طُلَّابٌ", isCorrect: true },
            { teks: "طَالِبُونَ", isCorrect: false },
            { teks: "طَوَالِبُ", isCorrect: false },
            { teks: "أَطْلَابٌ", isCorrect: false },
          ],
        },
        {
          pertanyaan: "أَيُّ الْكَلِمَاتِ التَّالِيَةِ فِعْلٌ مَاضٍ؟",
          opsiList: [
            { teks: "كَتَبَ", isCorrect: true },
            { teks: "يَكْتُبُ", isCorrect: false },
            { teks: "اُكْتُبْ", isCorrect: false },
            { teks: "كَاتِبٌ", isCorrect: false },
          ],
        },
        {
          pertanyaan: "مَا مُفْرَدُ كَلِمَةِ \"أَقْلَامٌ\"؟",
          opsiList: [
            { teks: "قَلَمٌ", isCorrect: true },
            { teks: "قَلَّامٌ", isCorrect: false },
            { teks: "مِقْلَمَةٌ", isCorrect: false },
            { teks: "قَلَائِمُ", isCorrect: false },
          ],
        },
        {
          pertanyaan: "أَيُّ هَذِهِ الْكَلِمَاتِ تَعْنِي \"مُعَلِّمٌ\"؟",
          opsiList: [
            { teks: "Teacher", isCorrect: true },
            { teks: "Student", isCorrect: false },
            { teks: "Doctor", isCorrect: false },
            { teks: "Farmer", isCorrect: false },
          ],
        },
      ][nomor];

    // ── PG_MULTI (Pilihan Ganda Multi) ──────────────────
    case "PG_MULTI":
      return [
        {
          pertanyaan: "اختر الأسماء المؤنثة من الكلمات التالية:",
          opsiList: [
            { teks: "مَدْرَسَةٌ", isCorrect: true },
            { teks: "مُعَلِّمَةٌ", isCorrect: true },
            { teks: "كِتَابٌ", isCorrect: false },
            { teks: "طَالِبٌ", isCorrect: false },
          ],
        },
        {
          pertanyaan: "اختر الحروف الجر مما يلي:",
          opsiList: [
            { teks: "فِي", isCorrect: true },
            { teks: "مِنْ", isCorrect: true },
            { teks: "عَلَى", isCorrect: true },
            { teks: "ثُمَّ", isCorrect: false },
          ],
        },
        {
          pertanyaan: "أَيُّ الْكَلِمَاتِ التَّالِيَةِ مَعْرِفَةٌ؟",
          opsiList: [
            { teks: "الطَّالِبُ", isCorrect: true },
            { teks: "هَذَا", isCorrect: true },
            { teks: "رَجُلٌ", isCorrect: false },
            { teks: "كِتَابٌ", isCorrect: false },
          ],
        },
      ][nomor];

    // ── BENAR_SALAH ─────────────────────────────────────
    case "BENAR_SALAH":
      return [
        {
          pertanyaan: "كلمة \"مُسْلِمُونَ\" هي جمع مذكر سالم.",
          opsiList: [
            { teks: "صحيح", isCorrect: true },
            { teks: "خطأ", isCorrect: false },
          ],
        },
        {
          pertanyaan: "الفعل المضارع يدل على الزمن الماضي.",
          opsiList: [
            { teks: "صحيح", isCorrect: false },
            { teks: "خطأ", isCorrect: true },
          ],
        },
        {
          pertanyaan: "حرف الجر \"فِي\" يفيد الظرفية.",
          opsiList: [
            { teks: "صحيح", isCorrect: true },
            { teks: "خطأ", isCorrect: false },
          ],
        },
        {
          pertanyaan: "كلمة \"مَدْرَسَةٌ\" هي اسم مذكر.",
          opsiList: [
            { teks: "صحيح", isCorrect: false },
            { teks: "خطأ", isCorrect: true },
          ],
        },
        {
          pertanyaan: "تكتب التاء المربوطة في نهاية الاسم المؤنث عادة.",
          opsiList: [
            { teks: "صحيح", isCorrect: true },
            { teks: "خطأ", isCorrect: false },
          ],
        },
      ][nomor];

    // ── ISIAN_SAMPING (Opsi Samping) ────────────────────
    case "ISIAN_SAMPING":
      return [
        {
          pertanyaan: "ذَهَبَ الطَّالِبُ إِلَى ___",
          opsiList: [
            { teks: "الْمَدْرَسَةِ", isCorrect: true },
            { teks: "الْمَدْرَسَةُ", isCorrect: false },
            { teks: "الْمَدْرَسَةَ", isCorrect: false },
          ],
        },
        {
          pertanyaan: "قَرَأْتُ ___ مُفِيدًا",
          opsiList: [
            { teks: "كِتَابًا", isCorrect: true },
            { teks: "كِتَابٌ", isCorrect: false },
            { teks: "كِتَابٍ", isCorrect: false },
          ],
        },
        {
          pertanyaan: "الْمُعَلِّمُ ___ فِي الْفَصْلِ",
          opsiList: [
            { teks: "يُدَرِّسُ", isCorrect: true },
            { teks: "دَرَّسَ", isCorrect: false },
            { teks: "دَرْسٌ", isCorrect: false },
          ],
        },
        {
          pertanyaan: "هَلْ ___ كِتَابَكَ أَمْسِ؟",
          opsiList: [
            { teks: "قَرَأْتَ", isCorrect: true },
            { teks: "يَقْرَأُ", isCorrect: false },
            { teks: "قَرَأْتُ", isCorrect: false },
          ],
        },
        {
          pertanyaan: "هَذِهِ ___ جَدِيدَةٌ",
          opsiList: [
            { teks: "سَيَّارَةٌ", isCorrect: true },
            { teks: "قَلَمٌ", isCorrect: false },
            { teks: "بَيْتٌ", isCorrect: false },
          ],
        },
      ][nomor];

    // ── ISIAN_BAWAH (Opsi Bawah / Bank Kata) ───────────
    case "ISIAN_BAWAH":
      return [
        {
          pertanyaan: "أَنَا ___ مِنَ الْيَابَانِ",
          opsiList: [
            { teks: "طَالِبٌ", isCorrect: true },
            { teks: "مَدْرَسَةٌ", isCorrect: false },
            { teks: "كِتَابٌ", isCorrect: false },
          ],
        },
        {
          pertanyaan: "هَذِهِ ___ جَمِيلَةٌ",
          opsiList: [
            { teks: "حَدِيقَةٌ", isCorrect: true },
            { teks: "مَسْجِدٌ", isCorrect: false },
            { teks: "قَلَمٌ", isCorrect: false },
          ],
        },
        {
          pertanyaan: "نَحْنُ ___ فِي الْجَامِعَةِ",
          opsiList: [
            { teks: "نَدْرُسُ", isCorrect: true },
            { teks: "يَدْرُسُ", isCorrect: false },
            { teks: "تَدْرُسُ", isCorrect: false },
          ],
        },
      ][nomor];

    // ── MUFRODAT (Pilih Mufrodat) ───────────────────────
    case "MUFRODAT":
      return [
        {
          pertanyaan: "اختر الترجمة الصحيحة لكلمة \"مَسْجِدٌ\"",
          opsiList: [
            { teks: "Masjid", isCorrect: true },
            { teks: "Sekolah", isCorrect: false },
            { teks: "Rumah", isCorrect: false },
            { teks: "Pasar", isCorrect: false },
          ],
        },
        {
          pertanyaan: "ما معنى \"سَرِيرٌ\"؟",
          opsiList: [
            { teks: "Tempat tidur", isCorrect: true },
            { teks: "Kursi", isCorrect: false },
            { teks: "Meja", isCorrect: false },
            { teks: "Lemari", isCorrect: false },
          ],
        },
        {
          pertanyaan: "ما معنى \"مِفْتَاحٌ\"؟",
          opsiList: [
            { teks: "Kunci", isCorrect: true },
            { teks: "Pintu", isCorrect: false },
            { teks: "Jendela", isCorrect: false },
            { teks: "Dinding", isCorrect: false },
          ],
        },
      ][nomor];

    // ── ESSAY_SINGKAT ───────────────────────────────────
    case "ESSAY_SINGKAT":
      return [
        {
          pertanyaan: "ما مصدر الفعل \"كَتَبَ\"؟",
          kunciJawaban: "كِتَابَة",
        },
        {
          pertanyaan: "ما مضارع الفعل \"جَلَسَ\"؟",
          kunciJawaban: "يَجْلِسُ",
        },
        {
          pertanyaan: "ما اسم الفاعل من \"عَلِمَ\"؟",
          kunciJawaban: "عَالِمٌ",
        },
        {
          pertanyaan: "ما مفرد كلمة \"كُتُبٌ\"؟",
          kunciJawaban: "كِتَابٌ",
        },
        {
          pertanyaan: "ما ضد كلمة \"كَبِيرٌ\"؟",
          kunciJawaban: "صَغِيرٌ",
        },
      ][nomor];

    // ── ESSAY_PANJANG (AI Grading) ──────────────────────
    case "ESSAY_PANJANG":
      return [
        {
          pertanyaan: "اُكْتُبْ فِقْرَةً قَصِيرَةً عَنْ يَوْمِكَ فِي الْمَدْرَسَةِ.",
          kunciJawaban: "أَذْهَبُ إِلَى الْمَدْرَسَةِ كُلَّ يَوْمٍ. أَدْرُسُ الْعَرَبِيَّةَ وَالرِّيَاضِيَّاتِ. أَلْعَبُ مَعَ أَصْدِقَائِي فِي الاسْتِرَاحَةِ. أَرْجِعُ إِلَى الْبَيْتِ بَعْدَ الظُّهْرِ.",
        },
        {
          pertanyaan: "صِفْ غُرْفَتَكَ بِخَمْسِ جُمَلٍ عَلَى الْأَقَلِّ.",
          kunciJawaban: "غُرْفَتِي وَاسِعَةٌ وَنَظِيفَةٌ. فِيهَا سَرِيرٌ كَبِيرٌ وَمَكْتَبٌ. عَلَى الْمَكْتَبِ كُتُبٌ وَحَاسُوبٌ. النَّافِذَةُ كَبِيرَةٌ وَالضَّوْءُ جَمِيلٌ. أُحِبُّ غُرْفَتِي كَثِيرًا.",
        },
        {
          pertanyaan: "تَكَلَّمْ عَنْ هِوَايَتِكَ الْمُفَضَّلَةِ.",
          kunciJawaban: "هِوَايَتِي الْمُفَضَّلَةُ هِيَ الْقِرَاءَةُ. أَقْرَأُ الْكُتُبَ الْعَرَبِيَّةَ كُلَّ يَوْمٍ. الْقِرَاءَةُ تُوَسِّعُ الْمَعْرِفَةَ وَتُقَوِّي اللُّغَةَ.",
        },
        {
          pertanyaan: "صِفْ صَدِيقَكَ الْمُفَضَّلَ لَنَا.",
          kunciJawaban: "صَدِيقِي الْمُفَضَّلُ اسْمُهُ عُمَر. هُوَ طَالِبٌ مُجْتَهِدٌ وَذَكِيٌّ كَثِيرًا. نَحْنُ نَلْعَبُ كُرَةَ الْقَدَمِ مَعًا فِي الْمَلْعَبِ. هُوَ يُحِبُّ مُسَاعَدَةَ الْآخَرِينَ.",
        },
        {
          pertanyaan: "تَكَلَّمْ عَنْ طُمُوحِكَ فِي الْمُسْتَقْبَلِ.",
          kunciJawaban: "أَتَمَنَّى أَنْ أُصْبِحَ مُعَلِّمًا لِلُّغَةِ الْعَرَبِيَّةِ. أُرِيدُ أَنْ أُعَلِّمَ النَّاسَ هَذِهِ اللُّغَةَ الْجَمِيلَةَ. ذَلِكَ لِأَنَّهَا لُغَةُ الْقُرْآنِ الْكَرِيمِ. سَأَدْرُسُ بِجِدٍّ لِتَحْقِيقِ هَذَا الْهَدَفِ.",
        },
      ][nomor];

    // ── MENJODOHKAN ─────────────────────────────────────
    case "MENJODOHKAN":
      return [
        {
          pertanyaan: "جَوِّدْ بَيْنَ الْكَلِمَةِ وَمَعْنَاهَا:",
          dataTambahan: {
            lefts: ["كِتَابٌ", "قَلَمٌ", "بَابٌ", "نَافِذَةٌ"],
            rights: ["Buku", "Pena", "Pintu", "Jendela"],
          },
        },
        {
          pertanyaan: "صِلْ بَيْنَ الْفِعْلِ وَمَصْدَرِهِ:",
          dataTambahan: {
            lefts: ["كَتَبَ", "قَرَأَ", "سَمِعَ", "عَلِمَ"],
            rights: ["كِتَابَة", "قِرَاءَة", "سَمَاع", "عِلْم"],
          },
        },
        {
          pertanyaan: "صِلْ بَيْنَ الضَّمِيرِ وَالْفِعْلِ الْمُنَاسِبِ:",
          dataTambahan: {
            lefts: ["أَنَا", "أَنْتَ", "هُوَ", "نَحْنُ"],
            rights: ["أَكْتُبُ", "تَكْتُبُ", "يَكْتُبُ", "نَكْتُبُ"],
          },
        },
        {
          pertanyaan: "صِلْ بَيْنَ الْكَلِمَةِ وَعَكْسِهَا (مضادها):",
          dataTambahan: {
            lefts: ["كَبِيرٌ", "طَوِيلٌ", "جَدِيدٌ", "غَنِيٌّ"],
            rights: ["صَغِيرٌ", "قَصِيرٌ", "قَدِيمٌ", "فَقِيرٌ"],
          },
        },
        {
          pertanyaan: "صِلْ بَيْنَ الدَّوْلَةِ وَعَاصِمَتِهَا:",
          dataTambahan: {
            lefts: ["إِنْدُونِيسِيَا", "مِصْر", "السُّعُودِيَّة", "مَالِيزِيَا"],
            rights: ["جَاكَرْتَا", "الْقَاهِرَة", "الرِّيَاض", "كُوَالَالُمْبُور"],
          },
        },
      ][nomor];

    // ── MENGURUTKAN ─────────────────────────────────────
    case "MENGURUTKAN":
      return [
        {
          pertanyaan: "رَتِّبِ الْكَلِمَاتِ لِتَكْوِينِ جُمْلَةٍ مُفِيدَةٍ:",
          dataTambahan: {
            items: ["ذَهَبَ", "الطَّالِبُ", "إِلَى", "الْمَدْرَسَةِ"],
          },
        },
        {
          pertanyaan: "رَتِّبِ الْجُمَلَ التَّالِيَةَ حَسَبَ التَّسَلْسُلِ الزَّمَنِيِّ:",
          dataTambahan: {
            items: ["اِسْتَيْقَظْتُ صَبَاحًا", "تَوَضَّأْتُ", "صَلَّيْتُ الْفَجْرَ", "ذَهَبْتُ إِلَى الْمَدْرَسَةِ"],
          },
        },
        {
          pertanyaan: "رَتِّبْ أَيَّامَ الْأُسْبُوعِ:",
          dataTambahan: {
            items: ["الْأَحَد", "الْاثْنَيْن", "الثُّلَاثَاء", "الْأَرْبِعَاء"],
          },
        },
      ][nomor];

    // ── KITABAH (Merangkai Huruf) ────────────────────────
    case "KITABAH":
      return [
        {
          pertanyaan: "رَكِّبِ الْحُرُوفَ لِتَكْوِينِ كَلِمَةٍ صَحِيحَةٍ (مَدْرَسَة):",
          dataTambahan: {
            huruf: ["م", "د", "ر", "س", "ة"],
          },
          kunciJawaban: "مَدْرَسَة",
        },
        {
          pertanyaan: "رَكِّبِ الْحُرُوفَ لِتَكْوِينِ كَلِمَةٍ صَحِيحَةٍ (مُعَلِّم):",
          dataTambahan: {
            huruf: ["م", "ع", "ل", "م"],
          },
          kunciJawaban: "مُعَلِّم",
        },
        {
          pertanyaan: "رَكِّبِ الْحُرُوفَ لِتَكْوِينِ كَلِمَةٍ صَحِيحَةٍ (مَكْتَبَة):",
          dataTambahan: {
            huruf: ["م", "ك", "ت", "ب", "ة"],
          },
          kunciJawaban: "مَكْتَبَة",
        },
      ][nomor];

    // ── DRAG_KATEGORI ───────────────────────────────────
    case "DRAG_KATEGORI":
      return [
        {
          pertanyaan: "صَنِّفِ الْكَلِمَاتِ التَّالِيَةَ إِلَى اسْمٍ وَفِعْلٍ:",
          dataTambahan: {
            categories: ["اسم", "فعل"],
            items: [
              { text: "كِتَابٌ", category: "اسم" },
              { text: "كَتَبَ", category: "فعل" },
              { text: "طَالِبٌ", category: "اسم" },
              { text: "دَرَسَ", category: "فعل" },
              { text: "قَلَمٌ", category: "اسم" },
              { text: "جَلَسَ", category: "فعل" },
            ],
          },
        },
        {
          pertanyaan: "صَنِّفِ الْكَلِمَاتِ إِلَى مُذَكَّرٍ وَمُؤَنَّثٍ:",
          dataTambahan: {
            categories: ["مذكر", "مؤنث"],
            items: [
              { text: "مُعَلِّمٌ", category: "مذكر" },
              { text: "مُعَلِّمَةٌ", category: "مؤنث" },
              { text: "طَبِيبٌ", category: "مذكر" },
              { text: "طَبِيبَةٌ", category: "مؤنث" },
              { text: "وَلَدٌ", category: "مذكر" },
              { text: "بِنْتٌ", category: "مؤنث" },
            ],
          },
        },
        {
          pertanyaan: "صَنِّفِ الْكَلِمَاتِ إِلَى مُفْرَدٍ وَجَمْعٍ:",
          dataTambahan: {
            categories: ["مفرد", "جمع"],
            items: [
              { text: "طَالِبٌ", category: "مفرد" },
              { text: "طُلَّابٌ", category: "جمع" },
              { text: "كِتَابٌ", category: "مفرد" },
              { text: "كُتُبٌ", category: "جمع" },
              { text: "مُعَلِّمٌ", category: "مفرد" },
              { text: "مُعَلِّمُونَ", category: "جمع" },
            ],
          },
        },
      ][nomor];

    // ── PARAGRAF_RUMPANG ────────────────────────────────
    case "PARAGRAF_RUMPANG":
      return [
        {
          pertanyaan: "أَنَا {{1}} مِنْ إِنْدُونِيسِيَا. أَدْرُسُ فِي {{2}} الْعَرَبِيَّةِ. أُحِبُّ {{3}} كَثِيرًا.",
          kunciJawaban: "طَالِبٌ|مَدْرَسَةِ|اللُّغَةَ",
        },
        {
          pertanyaan: "ذَهَبَ {{1}} إِلَى {{2}}. وَقَرَأَ {{3}} فِي الْمَكْتَبَةِ.",
          kunciJawaban: "أَحْمَدُ|الْجَامِعَةِ|كِتَابًا",
        },
        {
          pertanyaan: "فِي {{1}} أَشْجَارٌ {{2}}. وَالطُّيُورُ {{3}} عَلَى الْأَغْصَانِ.",
          kunciJawaban: "الْحَدِيقَةِ|كَثِيرَةٌ|تَغْرِدُ",
        },
      ][nomor];

    // ── IDENTIFIKASI_KESALAHAN ──────────────────────────
    case "IDENTIFIKASI_KESALAHAN":
      return [
        {
          pertanyaan: "حَدِّدِ الْكَلِمَةَ الْخَطَأَ نَحْوِيًّا:",
          dataTambahan: {
            words: ["ذَهَبَ", "الطَّالِبَاتُ", "إِلَى", "الْمَدْرَسَةِ"],
            correctIndex: 0, // ذَهَبَ should be ذَهَبَتْ
          },
          kunciJawaban: "ذَهَبَ (الصواب: ذَهَبَتْ لأن الفاعل مؤنث)",
        },
        {
          pertanyaan: "حَدِّدِ الْكَلِمَةَ الْخَطَأَ:",
          dataTambahan: {
            words: ["قَرَأَ", "مُحَمَّدٌ", "الْكِتَابُ", "بِعِنَايَةٍ"],
            correctIndex: 2, // الكتابُ should be الكتابَ (maf'ul bih)
          },
          kunciJawaban: "الْكِتَابُ (الصواب: الْكِتَابَ لأنه مفعول به منصوب)",
        },
        {
          pertanyaan: "حَدِّدِ الْكَلِمَةَ الْخَطَأَ:",
          dataTambahan: {
            words: ["الْمُسْلِمِينَ", "يُصَلُّونَ", "فِي", "الْمَسْجِدَ"],
            correctIndex: 3, // المسجدَ should be المسجدِ
          },
          kunciJawaban: "الْمَسْجِدَ (الصواب: الْمَسْجِدِ لأن فِي حرف جر)",
        },
      ][nomor];

    // ── TABEL_TASRIF ────────────────────────────────────
    case "TABEL_TASRIF":
      return [
        {
          pertanyaan: "أَكْمِلْ تَصْرِيفَ الْفِعْلِ \"كَتَبَ - يَكْتُبُ\":",
          dataTambahan: {
            headers: ["الماضي", "المضارع"],
            rows: [
              { label: "هُوَ", cells: [{ value: "كَتَبَ", isBlank: false }, { value: "يَكْتُبُ", isBlank: false }] },
              { label: "هِيَ", cells: [{ value: "كَتَبَتْ", isBlank: true }, { value: "تَكْتُبُ", isBlank: false }] },
              { label: "أَنَا", cells: [{ value: "كَتَبْتُ", isBlank: false }, { value: "أَكْتُبُ", isBlank: true }] },
              { label: "نَحْنُ", cells: [{ value: "كَتَبْنَا", isBlank: true }, { value: "نَكْتُبُ", isBlank: false }] },
            ]
          },
        },
        {
          pertanyaan: "أَكْمِلْ تَصْرِيفَ الْفِعْلِ \"جَلَسَ - يَجْلِسُ\":",
          dataTambahan: {
            headers: ["الماضي", "المضارع"],
            rows: [
              { label: "هُوَ", cells: [{ value: "جَلَسَ", isBlank: false }, { value: "يَجْلِسُ", isBlank: false }] },
              { label: "هُمْ", cells: [{ value: "جَلَسُوا", isBlank: true }, { value: "يَجْلِسُونَ", isBlank: false }] },
              { label: "أَنْتَ", cells: [{ value: "جَلَسْتَ", isBlank: false }, { value: "تَجْلِسُ", isBlank: true }] },
              { label: "أَنْتُمْ", cells: [{ value: "جَلَسْتُمْ", isBlank: true }, { value: "تَجْلِسُونَ", isBlank: false }] },
            ]
          },
        },
        {
          pertanyaan: "أَكْمِلْ تَصْرِيفَ الْفِعْلِ \"فَتَحَ - يَفْتَحُ\":",
          dataTambahan: {
            headers: ["الماضي", "المضارع"],
            rows: [
              { label: "هُوَ", cells: [{ value: "فَتَحَ", isBlank: false }, { value: "يَفْتَحُ", isBlank: false }] },
              { label: "هِيَ", cells: [{ value: "فَتَحَتْ", isBlank: false }, { value: "تَفْتَحُ", isBlank: true }] },
              { label: "أَنَا", cells: [{ value: "فَتَحْتُ", isBlank: true }, { value: "أَفْتَحُ", isBlank: false }] },
              { label: "هُمْ", cells: [{ value: "فَتَحُوا", isBlank: false }, { value: "يَفْتَحُونَ", isBlank: true }] },
            ]
          },
        },
        {
          pertanyaan: "أَكْمِلْ تَصْرِيفَ الْفِعْلِ \"عَلِمَ - يَعْلَمُ\":",
          dataTambahan: {
            headers: ["الماضي", "المضارع"],
            rows: [
              { label: "هُوَ", cells: [{ value: "عَلِمَ", isBlank: false }, { value: "يَعْلَمُ", isBlank: true }] },
              { label: "هِيَ", cells: [{ value: "عَلِمَتْ", isBlank: true }, { value: "تَعْلَمُ", isBlank: false }] },
              { label: "أَنْتِ", cells: [{ value: "عَلِمْتِ", isBlank: false }, { value: "تَعْلَمِينَ", isBlank: true }] },
              { label: "نَحْنُ", cells: [{ value: "عَلِمْنَا", isBlank: true }, { value: "نَعْلَمُ", isBlank: false }] },
            ]
          },
        },
        {
          pertanyaan: "أَكْمِلْ تَصْرِيفَ الْفِعْلِ \"قَرَأَ - يَقْرَأُ\":",
          dataTambahan: {
            headers: ["الماضي", "المضارع"],
            rows: [
              { label: "هُوَ", cells: [{ value: "قَرَأَ", isBlank: true }, { value: "يَقْرَأُ", isBlank: false }] },
              { label: "هُمَا", cells: [{ value: "قَرَأَا", isBlank: false }, { value: "يَقْرَءَانِ", isBlank: true }] },
              { label: "أَنَا", cells: [{ value: "قَرَأْتُ", isBlank: true }, { value: "أَقْرَأُ", isBlank: false }] },
              { label: "هُمْ", cells: [{ value: "قَرَءُوا|قرأوا", isBlank: false }, { value: "يَقْرَءُونَ|يقرأون", isBlank: true }] },
            ]
          },
        },
      ][nomor];

    // ── SUSUN_HURUF ─────────────────────────────────────
    case "SUSUN_HURUF":
      return [
        {
          pertanyaan: "رَتِّبِ الْحُرُوفَ لِتَكْوِينِ كَلِمَة (كِتَاب):",
          dataTambahan: {
            hurufAcak: ["ب", "ا", "ت", "ك"],
          },
          kunciJawaban: "كِتَاب",
        },
        {
          pertanyaan: "رَتِّبِ الْحُرُوفَ لِتَكْوِينِ كَلِمَة (مَدْرَسَة):",
          dataTambahan: {
            hurufAcak: ["س", "ر", "د", "م", "ة"],
          },
          kunciJawaban: "مَدْرَسَة",
        },
        {
          pertanyaan: "رَتِّبِ الْحُرُوفَ لِتَكْوِينِ كَلِمَة (مُعَلِّم):",
          dataTambahan: {
            hurufAcak: ["ع", "ل", "م", "م"],
          },
          kunciJawaban: "مُعَلِّم",
        },
        {
          pertanyaan: "رَتِّبِ الْحُرُوفَ لِتَكْوِينِ كَلِمَة (قَلَم):",
          dataTambahan: {
            hurufAcak: ["م", "ل", "ق"],
          },
          kunciJawaban: "قَلَم",
        },
        {
          pertanyaan: "رَتِّبِ الْحُرُوفَ لِتَكْوِينِ كَلِمَة (تِلْمِيذ):",
          dataTambahan: {
            hurufAcak: ["م", "ي", "ذ", "ل", "ت"],
          },
          kunciJawaban: "تِلْمِيذ",
        },
      ][nomor];

    // ── DRAG_TO_BLANK ───────────────────────────────────
    case "DRAG_TO_BLANK":
      return [
        {
          pertanyaan: "أَكْمِلِ الْفَرَاغَاتِ الطَّالِبُ إِلَى الْمَدْرَسَةِ...",
          dataTambahan: {
            paragraf: "ذَهَبَ {{1}} إِلَى {{2}} لِيَدْرُسَ {{3}}.",
            wordBank: ["الطَّالِبُ", "الْمَدْرَسَةِ", "الْعُلُومَ", "الْبَيْتِ"],
            blanks: [
              { index: "1", jawaban: "الطَّالِبُ" },
              { index: "2", jawaban: "الْمَدْرَسَةِ" },
              { index: "3", jawaban: "الْعُلُومَ" }
            ],
          },
        },
        {
          pertanyaan: "أحْمَدُ يَقْرَأُ الْقُرْآنَ...",
          dataTambahan: {
            paragraf: "{{1}} يَقْرَأُ {{2}} فِي {{3}}.",
            wordBank: ["أَحْمَدُ", "الْقُرْآنَ", "الْمَسْجِدِ", "الْمَطْبَخِ"],
            blanks: [
              { index: "1", jawaban: "أَحْمَدُ" },
              { index: "2", jawaban: "الْقُرْآنَ" },
              { index: "3", jawaban: "الْمَسْجِدِ" }
            ],
          },
        },
        {
          pertanyaan: "الْأُمُّ تَطْبُخُ الطَّعَامَ...",
          dataTambahan: {
            paragraf: "{{1}} تَطْبُخُ {{2}} فِي {{3}}.",
            wordBank: ["الْأُمُّ", "الطَّعَامَ", "الْمَطْبَخِ", "الْحَدِيقَةِ"],
            blanks: [
              { index: "1", jawaban: "الْأُمُّ" },
              { index: "2", jawaban: "الطَّعَامَ" },
              { index: "3", jawaban: "الْمَطْبَخِ" }
            ],
          },
        },
        {
          pertanyaan: "الْمُعَلِّمُ يَشْرَحُ الدَّرْسَ...",
          dataTambahan: {
            paragraf: "{{1}} يَشْرَحُ {{2}} أَمَامَ {{3}}.",
            wordBank: ["الْمُعَلِّمُ", "الدَّرْسَ", "الطُّلَّابِ", "الْمَلْعَبِ"],
            blanks: [
              { index: "1", jawaban: "الْمُعَلِّمُ" },
              { index: "2", jawaban: "الدَّرْسَ" },
              { index: "3", jawaban: "الطُّلَّابِ" }
            ],
          },
        },
        {
          pertanyaan: "خَرَجَ الْأَبُ إِلَى السُّوقِ...",
          dataTambahan: {
            paragraf: "خَرَجَ {{1}} إِلَى {{2}} لِيَشْتَرِيَ {{3}}.",
            wordBank: ["الْأَبُ", "السُّوقِ", "الْفَوَاكِهَ", "النَّوْمِ"],
            blanks: [
              { index: "1", jawaban: "الْأَبُ" },
              { index: "2", jawaban: "السُّوقِ" },
              { index: "3", jawaban: "الْفَوَاكِهَ" }
            ],
          },
        },
      ][nomor];

    // ── STABILO_SYNTAX / I'rab ──────────────────────────
    case "STABILO_SYNTAX":
      return [
        {
          pertanyaan: "حَدِّدْ إِعْرَابَ كُلِّ كَلِمَةٍ فِي الْجُمْلَةِ: \"كَتَبَ الطَّالِبُ الدَّرْسَ\"",
          dataTambahan: {
            words: ["كَتَبَ", "الطَّالِبُ", "الدَّرْسَ"],
            categories: [
              { name: "فعل", color: "#3B82F6" },
              { name: "فاعل", color: "#EF4444" },
              { name: "مفعول به", color: "#10B981" },
            ],
            answers: { "0": "فعل", "1": "فاعل", "2": "مفعول به" },
          },
        },
        {
          pertanyaan: "حَدِّدْ نَوْعَ كُلِّ كَلِمَةٍ: \"قَرَأَ مُحَمَّدٌ كِتَابًا مُفِيدًا\"",
          dataTambahan: {
            words: ["قَرَأَ", "مُحَمَّدٌ", "كِتَابًا", "مُفِيدًا"],
            categories: [
              { name: "فعل", color: "#3B82F6" },
              { name: "فاعل", color: "#EF4444" },
              { name: "مفعول به", color: "#10B981" },
              { name: "نعت", color: "#F59E0B" },
            ],
            answers: { "0": "فعل", "1": "فاعل", "2": "مفعول به", "3": "نعت" },
          },
        },
        {
          pertanyaan: "حَدِّدْ الْإِعْرَابَ: \"جَلَسَ الْوَلَدُ عَلَى الْكُرْسِيِّ\"",
          dataTambahan: {
            words: ["جَلَسَ", "الْوَلَدُ", "عَلَى", "الْكُرْسِيِّ"],
            categories: [
              { name: "فعل", color: "#3B82F6" },
              { name: "فاعل", color: "#EF4444" },
              { name: "حرف جر", color: "#8B5CF6" },
              { name: "اسم مجرور", color: "#EC4899" },
            ],
            answers: { "0": "فعل", "1": "فاعل", "2": "حرف جر", "3": "اسم مجرور" },
          },
        },
      ][nomor];

    // ── JARING_RELASI ───────────────────────────────────
    case "JARING_RELASI":
      return [
        {
          pertanyaan: "صِلْ كُلَّ ضَمِيرٍ بِالْأَفْعَالِ الْمُنَاسِبَةِ لَهُ:",
          dataTambahan: {
            lefts: ["هُوَ", "هِيَ"],
            rights: ["يَكْتُبُ", "تَكْتُبُ", "يَدْرُسُ", "تَدْرُسُ"],
            connections: [
              { left: 0, right: 0 }, // هو → يكتب
              { left: 0, right: 2 }, // هو → يدرس
              { left: 1, right: 1 }, // هي → تكتب
              { left: 1, right: 3 }, // هي → تدرس
            ],
          },
        },
        {
          pertanyaan: "صِلْ كُلَّ حَرْفِ جَرٍّ بِالْعِبَارَاتِ الَّتِي تُنَاسِبُهُ:",
          dataTambahan: {
            lefts: ["فِي", "مِنْ"],
            rights: ["الْبَيْتِ", "الْمَدْرَسَةِ", "مِصْرَ", "الْفَصْلِ"],
            connections: [
              { left: 0, right: 0 }, // في → البيت
              { left: 0, right: 3 }, // في → الفصل
              { left: 1, right: 1 }, // من → المدرسة
              { left: 1, right: 2 }, // من → مصر
            ],
          },
        },
        {
          pertanyaan: "صِلْ كُلَّ كَلِمَةٍ بِأَوْزَانِهَا الصَّرْفِيَّةِ:",
          dataTambahan: {
            lefts: ["فَعَلَ", "فَاعِلٌ"],
            rights: ["كَتَبَ", "جَلَسَ", "كَاتِبٌ", "جَالِسٌ"],
            connections: [
              { left: 0, right: 0 }, // فعل → كتب
              { left: 0, right: 1 }, // فعل → جلس
              { left: 1, right: 2 }, // فاعل → كاتب
              { left: 1, right: 3 }, // فاعل → جالس
            ],
          },
        },
      ][nomor];

    default:
      return {
        pertanyaan: `سؤال تجريبي رقم ${nomor + 1}`,
      };
  }
}

async function main() {
  console.log("🚀 Memulai seed sample soal berbahasa Arab...\n");

  // 1. Upsert Program Tarqiyah
  const program = await prisma.program.upsert({
    where: { nama_indo: "Tarqiyah" },
    update: {},
    create: {
      nama_indo: "Tarqiyah",
      nama_arab: "ترقية",
      kkm: 60,
    },
  });
  console.log(`✅ Program: ${program.nama_indo} (${program.id})`);

  // 2. Upsert Mapel Tes
  let mapel = await prisma.mapel.findFirst({
    where: {
      nama_indo: "Tes",
      programMapels: { some: { programId: program.id } },
    },
  });

  if (!mapel) {
    mapel = await prisma.mapel.create({
      data: {
        nama_indo: "Tes",
        nama_arab: "الاختبار",
        jumlah_tes: 3,
        bobot: 100,
        bobot_usbu: 100,
      },
    });

    // Link via ProgramMapel — find next urutan
    const lastPM = await prisma.programMapel.findFirst({
      where: { programId: program.id },
      orderBy: { urutan: "desc" },
    });
    const nextUrutan = (lastPM?.urutan ?? 0) + 1;

    await prisma.programMapel.upsert({
      where: {
        programId_mapelId: {
          programId: program.id,
          mapelId: mapel.id,
        },
      },
      update: {},
      create: {
        programId: program.id,
        mapelId: mapel.id,
        urutan: nextUrutan,
      },
    });
  }
  console.log(`✅ Mapel: ${mapel.nama_indo} (${mapel.id})`);

  // 3. Buat JenisSoal + Soal untuk setiap tipe
  let totalSoal = 0;

  for (let tipeIdx = 0; tipeIdx < ALL_TIPE_SOAL.length; tipeIdx++) {
    const tipe = ALL_TIPE_SOAL[tipeIdx];

    // Upsert JenisSoal
    const jenisSoal = await prisma.jenisSoal.upsert({
      where: {
        mapelId_nama: {
          mapelId: mapel.id,
          nama: tipe,
        },
      },
      update: {},
      create: {
        mapelId: mapel.id,
        nama: tipe,
        urutan: tipeIdx + 1,
      },
    });

    // Cek apakah sudah ada soal di jenis ini
    const existingCount = await prisma.bankSoalUsbu.count({
      where: {
        jenisSoalId: jenisSoal.id,
        programId: program.id,
        mapelId: mapel.id,
      },
    });

    if (existingCount > 0) {
       // Delete old seeded questions so we can inject the perfect 5 new questions
       await prisma.bankSoalUsbu.deleteMany({
          where: {
            jenisSoalId: jenisSoal.id,
            programId: program.id,
            mapelId: mapel.id,
          }
       });
       console.log(`♻️  ${tipe}: menghapus soal lama untuk di-seed ulang.`);
    }

    // Buat soal dinamis selama data dari fungsi masih ada
    let n = 0;
    while (true) {
      const data = buildSoalData(tipe, n);
      if (!data) {
        if (n === 0) console.warn(`⚠️  ${tipe}: data kosong, tidak ada soal ditambahkan.`);
        break; // Habis
      }

      const isPilihanGanda = ["PG", "PG_MULTI", "BENAR_SALAH", "MUFRODAT", "ISIAN_SAMPING", "ISIAN_BAWAH"].includes(tipe);

      await prisma.bankSoalUsbu.create({
        data: {
          mapelId: mapel.id,
          programId: program.id,
          jenisSoalId: jenisSoal.id,
          tipeSoal: tipe,
          pertanyaan: data.pertanyaan,
          bobot: Number((100 / 3).toFixed(2)),
          kunciJawaban: data.kunciJawaban || null,
          dataTambahan: data.dataTambahan || null,
          opsiList: isPilihanGanda && data.opsiList
            ? {
                create: data.opsiList.map((opsi, i) => ({
                  teks: opsi.teks,
                  isCorrect: opsi.isCorrect,
                  urutan: i + 1,
                })),
              }
            : undefined,
        },
      });
      totalSoal++;
      n++;
    }

    console.log(`✅ ${tipe}: ${n} soal berhasil ditambahkan`);
  }

  console.log(`\n🎉 Selesai! Total ${totalSoal} soal ditambahkan ke Program "${program.nama_indo}", Mapel "${mapel.nama_indo}".`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("❌ Error:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
