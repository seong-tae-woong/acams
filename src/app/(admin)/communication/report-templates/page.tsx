'use client';
import Topbar from '@/components/admin/Topbar';
import ReportTemplatesEditor from '@/components/communication/ReportTemplatesEditor';

export default function ReportTemplatesPage() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="리포트 양식 관리" badge="시험별·주기별 양식" />
      <ReportTemplatesEditor />
    </div>
  );
}
