import { motion } from 'framer-motion';
import { Wallet, LayoutGrid, Shield, Brain, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { containerVariants, itemVariants } from '@/lib/animations';
import { cn } from '@/lib/utils';

interface ModuleCard {
  title: string;
  icon: React.ReactNode;
  href: string;
  badgeClass: string;
  features: string[];
}

export default function Home() {
  const { t } = useTranslation();

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
      icon: <Brain className="h-8 w-8" />,
      href: '/library/books',
      badgeClass: 'agent-badge-intellect',
      features: t('pages.home.library.features', { returnObjects: true }) as string[],
    },
  ];

  return (
    // ponytail: 5rem ≈ altura do Header; ajustar se o Header mudar de altura
    <PageContainer className="flex min-h-[calc(100dvh-5rem)] flex-col justify-center">
      <div className="space-y-lg">
        <PageHeader title={t('pages.home.modulesTitle')} icon={<LayoutGrid />} />
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
                <Card className="hover:border-primary/40 hoverable:hover:scale-[1.02] h-full transition">
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
    </PageContainer>
  );
}
