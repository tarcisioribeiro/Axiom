import { Wand2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { PageHeader } from '@/components/common/PageHeader';
import { PageContainer } from '@/components/common/PageContainer';
import { PasswordGenerator } from '@/components/security/PasswordGenerator';

export default function PasswordGeneratorPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Gerador de Senhas"
        icon={<Wand2 />}
      />

      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Gerar Senha Segura</CardTitle>
            <CardDescription>
              Crie senhas criptograficamente seguras com opções configuráveis.
              As senhas são geradas no servidor usando algoritmos seguros.
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
