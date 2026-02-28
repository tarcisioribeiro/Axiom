import { Wand2 } from 'lucide-react';

import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { PasswordGenerator } from '@/components/security/PasswordGenerator';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function PasswordGeneratorPage() {
  return (
    <PageContainer>
      <PageHeader title="Gerador de Senhas" icon={<Wand2 />} />

      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Gerar Senha Segura</CardTitle>
            <CardDescription>
              Crie senhas criptograficamente seguras com opções configuráveis. As senhas
              são geradas no servidor usando algoritmos seguros.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordGenerator />
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
