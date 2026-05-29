import { Paperclip } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from './button';

interface FileInputProps {
  id?: string;
  accept?: string;
  onChange?: (file: File | null) => void;
  className?: string;
}

export function FileInput({ id, accept, onChange, className }: FileInputProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleClick = () => inputRef.current?.click();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setFileName(file?.name ?? null);
    onChange?.(file);
  };

  return (
    <div className={`flex items-center gap-sm ${className ?? ''}`}>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={handleChange}
      />
      <Button type="button" variant="outline" size="sm" onClick={handleClick}>
        <Paperclip className="mr-xs h-4 w-4" />
        {t('common.fileInput.selectFile')}
      </Button>
      <span className="truncate text-sm text-muted-foreground">
        {fileName ?? t('common.fileInput.noFileSelected')}
      </span>
    </div>
  );
}
