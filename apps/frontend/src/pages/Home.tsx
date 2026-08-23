/* eslint-disable max-lines */
import {
  WalletIcon as Wallet,
  ArrowTrendingDownIcon as TrendingDown,
  ArrowTrendingUpIcon as TrendingUp,
  CreditCardIcon as CreditCard,
  ArrowsRightLeftIcon as ArrowLeftRight,
  KeyIcon as Key,
  LockClosedIcon as Lock,
  BookOpenIcon as BookOpen,
  BookmarkSquareIcon as BookMarked,
  Squares2X2Icon as LayoutDashboard,
  ShieldCheckIcon as Shield,
  BuildingLibraryIcon as Library,
  CalendarIcon as Calendar,
  ShareIcon as GitFork,
  ArrowTopRightOnSquareIcon as ExternalLink,
} from '@heroicons/react/24/solid';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { containerVariants, itemVariants } from '@/lib/animations';
import { STALE_TIMES } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { knowledgeGraphService } from '@/services/knowledge-graph-service';

interface ModuleCard {
  title: string;
  icon: React.ReactNode;
  href: string;
  badgeClass: string;
  features: string[];
}

export default function Home() {
  const { t } = useTranslation();

  const { data: graphData } = useQuery({
    queryKey: ['knowledge-graph', 'summary'],
    queryFn: () => knowledgeGraphService.getGraph(false),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const modules: ModuleCard[] = [
    {
      title: t('pages.home.planning.title'),
      icon: <Calendar className="h-8 w-8" />,
      href: '/planning/dashboard',
      badgeClass: 'agent-badge-personal',
      features: t('pages.home.planning.features', { returnObjects: true }) as string[],
    },
    {
      title: t('pages.home.finance.title'),
      icon: <Wallet className="h-8 w-8" />,
      href: '/dashboard',
      badgeClass: 'agent-badge-financial',
      features: t('pages.home.finance.features', { returnObjects: true }) as string[],
    },
    {
      title: t('pages.home.security.title'),
      icon: <Shield className="h-8 w-8" />,
      href: '/security/passwords',
      badgeClass: 'agent-badge-security',
      features: t('pages.home.security.features', { returnObjects: true }) as string[],
    },
    {
      title: t('pages.home.library.title'),
      icon: <Library className="h-8 w-8" />,
      href: '/library/books',
      badgeClass: 'agent-badge-intellect',
      features: t('pages.home.library.features', { returnObjects: true }) as string[],
    },
  ];

  const quickActions = [
    {
      icon: <TrendingDown className="h-5 w-5" />,
      label: t('pages.home.quickActions.newExpense'),
      href: '/expenses',
    },
    {
      icon: <TrendingUp className="h-5 w-5" />,
      label: t('pages.home.quickActions.newRevenue'),
      href: '/revenues',
    },
    {
      icon: <ArrowLeftRight className="h-5 w-5" />,
      label: t('pages.home.quickActions.transfer'),
      href: '/transfers',
    },
    {
      icon: <CreditCard className="h-5 w-5" />,
      label: t('pages.home.quickActions.cards'),
      href: '/credit-cards',
    },
    {
      icon: <Key className="h-5 w-5" />,
      label: t('pages.home.quickActions.passwords'),
      href: '/security/passwords',
    },
    {
      icon: <BookOpen className="h-5 w-5" />,
      label: t('pages.home.quickActions.books'),
      href: '/library/books',
    },
  ];

  return (
    <PageContainer className="space-y-xl">
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="gap-sm flex items-center">
            <LayoutDashboard className="h-5 w-5" />
            {t('pages.home.quickActionsTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <motion.div
            className="gap-md grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {quickActions.map((action) => (
              <motion.div key={action.href} variants={itemVariants}>
                <Link
                  to={action.href}
                  className="gap-sm border-border p-md hover:border-primary hover:bg-accent hoverable:hover:scale-105 flex flex-col items-center justify-center rounded-lg border transition"
                >
                  <div className="bg-primary/10 text-primary rounded-full p-3">
                    {action.icon}
                  </div>
                  <span className="text-center text-sm font-medium">
                    {action.label}
                  </span>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </CardContent>
      </Card>

      {/* Modules */}
      <div className="space-y-lg">
        <PageHeader title={t('pages.home.modulesTitle')} />
        <motion.div
          className="gap-lg grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {modules.map((module) => (
            <motion.div key={module.href} variants={itemVariants}>
              <Link
                to={module.href}
                className="group block h-full"
                aria-label={t('pages.home.modules.navigateTo', {
                  module: module.title,
                })}
              >
                <Card className="hover:border-primary hoverable:hover:scale-[1.02] h-full border-2 transition hover:shadow-md">
                  <CardHeader>
                    <motion.div
                      className={cn(
                        'mb-md flex h-16 w-16 items-center justify-center rounded-lg',
                        module.badgeClass
                      )}
                      whileHover={{ scale: 1.15, rotate: 5 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    >
                      {module.icon}
                    </motion.div>
                    <CardTitle className="text-xl">{module.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-sm">
                      {module.features.map((feature) => (
                        <li key={feature} className="gap-sm flex items-center text-sm">
                          <div className="bg-primary h-1.5 w-1.5 rounded-full" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Knowledge Graph Widget */}
      <Link to="/library/knowledge-graph" className="block">
        <Card className="border-primary/20 hover:border-primary transition hover:shadow-md">
          <CardHeader className="pb-sm">
            <CardTitle className="gap-sm flex items-center text-sm font-medium">
              <GitFork className="text-primary h-4 w-4" />
              {t('pages.home.knowledgeGraph.title')}
              <ExternalLink className="text-muted-foreground ml-auto h-3.5 w-3.5" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="gap-lg flex items-center">
              <div className="gap-xs flex flex-col">
                <span className="text-2xl font-bold">
                  {graphData?.nodes?.length ?? '—'}
                </span>
                <span className="text-muted-foreground text-xs">
                  {t('pages.home.knowledgeGraph.nodes')}
                </span>
              </div>
              <div className="bg-border h-8 w-px" />
              <div className="gap-xs flex flex-col">
                <span className="text-2xl font-bold">
                  {graphData?.links?.length ?? '—'}
                </span>
                <span className="text-muted-foreground text-xs">
                  {t('pages.home.knowledgeGraph.links')}
                </span>
              </div>
              <p className="text-muted-foreground ml-auto text-xs">
                {t('pages.home.knowledgeGraph.desc')}
              </p>
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Info Cards */}
      <motion.div
        className="gap-md grid grid-cols-1 md:grid-cols-3"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
      >
        <motion.div variants={itemVariants}>
          <Card className="border-success/20 from-success/10 to-success/20 bg-gradient-to-br">
            <CardHeader>
              <CardTitle className="gap-sm text-success flex items-center">
                <Wallet className="h-5 w-5" />
                {t('pages.home.infoCards.financeTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{t('pages.home.infoCards.financeDesc')}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-info/20 from-info/10 to-primary/20 bg-gradient-to-br">
            <CardHeader>
              <CardTitle className="gap-sm text-info flex items-center">
                <Lock className="h-5 w-5" />
                {t('pages.home.infoCards.securityTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{t('pages.home.infoCards.securityDesc')}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-primary/20 from-primary/10 to-accent/20 bg-gradient-to-br">
            <CardHeader>
              <CardTitle className="gap-sm text-primary flex items-center">
                <BookMarked className="h-5 w-5" />
                {t('pages.home.infoCards.knowledgeTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{t('pages.home.infoCards.knowledgeDesc')}</p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </PageContainer>
  );
}
