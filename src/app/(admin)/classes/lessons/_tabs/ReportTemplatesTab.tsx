'use client';
import Topbar from '@/components/admin/Topbar';
import Tabs from '@/components/shared/Tabs';
import ReportTemplatesEditor from '@/components/communication/ReportTemplatesEditor';
import { type MainTab, TAB_OPTIONS } from '../_shared';

interface ReportTemplatesTabProps {
  mainTab: MainTab;
  setMainTab: (t: MainTab) => void;
}

export default function ReportTemplatesTab({ mainTab, setMainTab }: ReportTemplatesTabProps) {
  return (
    <>
      <Topbar
        title="수업 관리"
        actions={<div className="flex gap-2" />}
      />
      <div className="px-5 pt-3 bg-white">
        <Tabs
          tabs={TAB_OPTIONS}
          value={mainTab}
          onChange={(v) => setMainTab(v as MainTab)}
        />
      </div>

      {/* 리포트 양식 탭 — 자체 레이아웃 */}
      <ReportTemplatesEditor />
    </>
  );
}
