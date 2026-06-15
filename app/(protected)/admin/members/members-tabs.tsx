'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Users, ClipboardCheck } from 'lucide-react';
import { MembersClient } from './members-client';
import AdminApprovals from '@/components/admin-approvals';
import type { Member } from './member.types';
import type { PaginationMeta } from '@/lib/pagination';
import { apiFetch } from '@/lib/api-fetch';

type Tab = 'members' | 'approvals';

interface MembersTabsProps {
  initialMembers: Member[];
  clubId: string;
  pagination: PaginationMeta;
}

export function MembersTabs({ initialMembers, clubId, pagination }: MembersTabsProps) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>(
    searchParams.get('tab') === 'approvals' ? 'approvals' : 'members'
  );
  const [approvalCount, setApprovalCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    apiFetch('/api/admin/approvals/count', { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => setApprovalCount(data?.count ?? 0))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return (
    <div>
      {/* Tab Bar */}
      <div className="flex gap-1 border-b px-4 md:px-6 pt-4 md:pt-6">
        <button
          onClick={() => setActiveTab('members')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'members'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
          }`}
        >
          <Users className="h-4 w-4" />
          Alle Mitglieder
        </button>
        <button
          onClick={() => setActiveTab('approvals')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'approvals'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
          }`}
        >
          <ClipboardCheck className="h-4 w-4" />
          Genehmigungen
          {approvalCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold bg-brand-primary text-white">
              {approvalCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'members' ? (
        <MembersClient initialMembers={initialMembers} clubId={clubId} pagination={pagination} />
      ) : (
        <div className="px-4 md:px-6">
          <AdminApprovals />
        </div>
      )}
    </div>
  );
}
