import Link from "next/link";

/** เดโม: ระบบจริงมีแถบเมนูข้างที่กรองตามสิทธิ์ผู้ใช้ เดโมใช้แถบบนอย่างง่ายแทน */
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="flex items-center gap-3 border-b bg-amber-500/10 px-5 py-2 text-xs">
        <Link href="/" className="underline underline-offset-4">← หน้าแรก</Link>
        <span className="text-amber-700 dark:text-amber-400">เดโม · ข้อมูลจำลอง ไม่ใช่ข้อมูลผู้ป่วยจริง</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
