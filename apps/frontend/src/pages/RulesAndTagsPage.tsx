import { Filter, Tag, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PageContainer } from '@/components/common/PageContainer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import AutomationRules from './AutomationRules';
import CategorizationRules from './CategorizationRules';
import Tags from './Tags';

const TAB_KEY = 'rulesAndTags.activeTab';

export default function RulesAndTagsPage() {
  const { t } = useTranslation();

  const defaultTab = localStorage.getItem(TAB_KEY) ?? 'categorization';

  const handleTabChange = (value: string) => {
    localStorage.setItem(TAB_KEY, value);
  };

  return (
    <PageContainer className="flex flex-1 flex-col">
      <Tabs
        defaultValue={defaultTab}
        onValueChange={handleTabChange}
        className="flex flex-1 flex-col"
      >
        <TabsList className="mb-lg w-full">
          <TabsTrigger value="categorization" className="gap-xs flex-1">
            <Filter className="h-4 w-4" />
            {t('nav.items.categorizationRules')}
          </TabsTrigger>
          <TabsTrigger value="automation" className="gap-xs flex-1">
            <Zap className="h-4 w-4" />
            {t('nav.items.automationRules')}
          </TabsTrigger>
          <TabsTrigger value="tags" className="gap-xs flex-1">
            <Tag className="h-4 w-4" />
            {t('nav.items.tags')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categorization" className="mt-0 flex-1">
          <CategorizationRules embedded />
        </TabsContent>

        <TabsContent value="automation" className="mt-0 flex-1">
          <AutomationRules embedded />
        </TabsContent>

        <TabsContent value="tags" className="mt-0 flex-1">
          <Tags embedded />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
