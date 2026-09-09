import { ArankubApp } from "@/components/arankub/ArankubApp";

export const dynamic = "force-dynamic";

/**
 * เดโม: ระบบจริงอ่านชื่อผู้ใช้จาก session และอ่านโมเดล AI ที่ตั้งเป็นค่าเริ่มต้นจากฐานข้อมูล
 * เดโมใส่ค่าคงที่แทน เพราะไม่มีทั้งระบบล็อกอินและฐานข้อมูล
 */
export default function AiPage() {
  return (
    <ArankubApp
      userName="ผู้ใช้ทดลอง"
      userRole="เจ้าหน้าที่โรงพยาบาล"
      model="demo"
      isAdmin={false}
    />
  );
}
