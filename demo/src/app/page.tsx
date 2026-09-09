import Link from "next/link";

/**
 * หน้าแรกของเดโม — ไม่มีในระบบจริง
 *
 * ระบบจริงเข้าหน้าล็อกอินก่อน แล้วเห็นเมนูตามสิทธิ์ที่ผู้ดูแลกำหนดให้
 * เดโมไม่มีระบบสิทธิ์ จึงทำหน้ารวมลิงก์ไว้ให้เข้าดูแต่ละหน้าจอได้ตรง ๆ
 */

const SCREENS = [
  {
    href: "/ai",
    title: "ARANKUB AI",
    desc: "หน้าภาพรวมโรงพยาบาล — ผู้ป่วยนอก/ผู้ป่วยใน การครองเตียง รายงาน การเงิน และผู้ช่วย AI",
    note: "ลองถาม “สรุปยอดผู้ป่วยนอกวันนี้” หรือ “วาดกราฟโรคที่พบมากที่สุด” ในแท็บผู้ช่วย AI",
  },
  {
    href: "/drg-analyzer",
    title: "DRG Analyzer",
    desc: "ตรวจความครบถ้วนของรหัสโรคผู้ป่วยใน เทียบกับ ThaiDRG และเสนอรหัสที่อาจตกหล่น",
    note: "ปุ่มคำนวณ DRG และตรวจชาร์จใช้ได้เฉพาะระบบที่ติดตั้งจริง",
  },
  {
    href: "/rag",
    title: "คลังความรู้ (RAG)",
    desc: "เกณฑ์ สปสช. รหัส ICD ประกาศกระทรวง และแนวทางเวชปฏิบัติที่ระบบใช้อ้างอิง",
    note: "การนำเข้าเอกสารใช้ได้เฉพาะระบบที่ติดตั้งจริง",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
        เดโม · ข้อมูลทั้งหมดเป็นข้อมูลจำลอง
      </div>

      <h1 className="mt-4 text-3xl font-bold tracking-tight">ARANKUB</h1>
      <p className="mt-2 text-muted-foreground">
        ระบบ AI ช่วยงานข้อมูลโรงพยาบาล — ลงรหัสโรค ตรวจสอบการเบิกจ่าย และวิเคราะห์ข้อมูลผู้ป่วย
      </p>
      <p className="mt-4 max-w-prose text-sm text-muted-foreground">
        เดโมนี้แสดงหน้าจอจริงของระบบ แต่ข้อมูลทั้งหมดถูกสร้างขึ้นมา ไม่มีข้อมูลผู้ป่วยจริง
        และไม่ได้เชื่อมต่อกับ HosXP หรือฐานข้อมูลใด ๆ ส่วนที่ต้องใช้โมเดลภาษา ตัวจัดกลุ่ม DRG
        หรือการอ่านเอกสารสแกน จะแจ้งว่าใช้ได้เฉพาะระบบที่ติดตั้งจริง
      </p>

      <div className="mt-10 grid gap-4">
        {SCREENS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group rounded-lg border p-5 transition-colors hover:border-foreground/30 hover:bg-accent/40"
          >
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-semibold">{s.title}</h2>
              <span className="text-sm text-muted-foreground transition-transform group-hover:translate-x-0.5">
                เปิด →
              </span>
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">{s.desc}</p>
            <p className="mt-2 text-xs text-muted-foreground/80">{s.note}</p>
          </Link>
        ))}
      </div>

      <div className="mt-10 rounded-lg bg-muted/50 p-5 text-sm">
        <p className="font-medium">ระบบเต็มมีอะไรอีกบ้าง</p>
        <p className="mt-1.5 text-muted-foreground">
          OPD Analyzer · ODS ผ่าตัดวันเดียว · REP ผลตรวจสอบ สปสช. · กองทุนและการเบิกจ่าย ·
          ส่งยาที่บ้าน · ลูกหนี้/การเงิน · ประกันสังคม · ตรวจคุณภาพ 43 แฟ้ม · HDC ·
          รายงานตรวจสุขภาพ · เครื่องมือเขียน SQL — รวม 18 โมดูลที่เปิด-ปิดแยกกันได้
        </p>
        <a
          href="https://github.com/payang24-DRCOMP/ARANKUB"
          className="mt-3 inline-block underline underline-offset-4"
          target="_blank"
          rel="noreferrer"
        >
          ดูเอกสารระบบทั้งหมดบน GitHub
        </a>
      </div>

      <footer className="mt-12 border-t pt-6 text-xs text-muted-foreground">
        ARANKUB · พัฒนาโดยโรงพยาบาลอรัญประเทศ เพื่อโรงพยาบาลรัฐ
      </footer>
    </main>
  );
}
