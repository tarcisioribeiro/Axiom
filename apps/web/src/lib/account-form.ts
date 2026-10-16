/** Formulário de conta: cadastro público e criação de staff no admin. */

export const formatCpf = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

export const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

export interface AccountFormData {
  username: string;
  password: string;
  confirmPassword: string;
  name: string;
  document: string;
  phone: string;
  email: string;
}

/** Corpo enviado à API (cadastro público e criação de staff). */
export const toAccountPayload = (data: AccountFormData) => ({
  username: data.username,
  password: data.password,
  name: data.name,
  document: data.document.replace(/\D/g, ''),
  phone: data.phone.replace(/\D/g, ''),
  email: data.email,
});
