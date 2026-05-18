'use client';
import Topbar from '@/components/admin/Topbar';
import Tabs from '@/components/shared/Tabs';
import ReportPublishHub from '@/components/communication/ReportPublishHub';
import { type MainTab, TAB_OPTIONS } from '../_shared';

interface PublishTabProps {
  mainTab: MainTab;
  setMainTab: (t: MainTab) => void;
}

export default function PublishTab({ mainTab, setMainTab }: PublishTabProps) {
  return (
    <>
      <Topbar
        title="성적 관리"
        actions={<div className="flex gap-2" />}
      />
      <div className="px-5 pt-3 bg-white">
        <Tabs
          tabs={TAB_OPTIONS}
          value={mainTab}
          onChange={(v) => setMainTab(v as MainTab)}
        />
      </div>

      {/* 리포트 발행 탭 — 자체 레이아웃 */}
      <ReportPublishHub />
    </>
  );
}
