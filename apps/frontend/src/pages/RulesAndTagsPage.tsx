import { Plus, Tag, Zap } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import AutomationRules from './AutomationRules';
import Tags from './Tags';

const TAB_KEY = 'rulesAndTags.activeTab';
const VALID_TABS = new Set(['automation', 'tags']);

export default function RulesAndTagsPage() {
  const { t } = useTranslation();

  const storedTab = localStorage.getItem(TAB_KEY);
  const [activeTab, setActiveTab] = useState(
    storedTab && VALID_TABS.has(storedTab) ? storedTab : 'automation'
  );

  const newRuleRef = useRef<() => void>(undefined);
  const applyAllRef = useRef<() => void>(undefined);
  const newTagRef = useRef<() => void>(undefined);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    localStorage.setItem(TAB_KEY, value);
  };

  return (
    <PageContainer className="flex flex-1 flex-col">
      {activeTab === 'automation' && (
        <PageHeader
          title={t('pages.automationRules.title')}
          icon={<Zap />}
          actions={
            <Button variant="outline" onClick={() => applyAllRef.current?.()}>
              <Zap className="h-4 w-4" />
              {t('pages.automationRules.applyAll')}
            </Button>
          }
          action={{
            label: t('pages.automationRules.newRule'),
            icon: <Plus className="h-4 w-4" />,
            onClick: () => newRuleRef.current?.(),
          }}
        />
      )}

      {activeTab === 'tags' && (
        <PageHeader
          title={t('pages.tags.title')}
          icon={<Tag className="h-5 w-5" />}
          action={{
            label: t('pages.tags.newBtn'),
            icon: <Plus className="h-4 w-4" />,
            onClick: () => newTagRef.current?.(),
          }}
        />
      )}

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="flex flex-1 flex-col"
      >
        <TabsList className="mb-lg w-full">
          <TabsTrigger value="automation" className="gap-xs flex-1">
            <Zap className="h-4 w-4" />
            {t('nav.items.automationRules')}
          </TabsTrigger>
          <TabsTrigger value="tags" className="gap-xs flex-1">
            <Tag className="h-4 w-4" />
            {t('nav.items.tags')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="automation" className="mt-0 flex-1">
          <AutomationRules embedded newRuleRef={newRuleRef} applyAllRef={applyAllRef} />
        </TabsContent>

        <TabsContent value="tags" className="mt-0 flex-1">
          <Tags embedded newTagRef={newTagRef} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
