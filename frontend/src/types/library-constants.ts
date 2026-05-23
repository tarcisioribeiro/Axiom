export type Era = 'AC' | 'DC';

export const ERAS = [
  { value: 'DC' as Era, label: 'Depois de Cristo (DC)' },
  { value: 'AC' as Era, label: 'Antes de Cristo (AC)' },
];

export const NATIONALITIES = [
  { value: 'ALE', label: 'Alemã' },
  { value: 'USA', label: 'Americana' },
  { value: 'ARG', label: 'Argentina' },
  { value: 'AUL', label: 'Australiana' },
  { value: 'AUS', label: 'Austríaca' },
  { value: 'BEL', label: 'Belga' },
  { value: 'BRA', label: 'Brasileira' },
  { value: 'CAN', label: 'Canadense' },
  { value: 'CZE', label: 'Checa' },
  { value: 'CHL', label: 'Chilena' },
  { value: 'CHN', label: 'Chinesa' },
  { value: 'COL', label: 'Colombiana' },
  { value: 'CUB', label: 'Cubana' },
  { value: 'DEN', label: 'Dinamarquesa' },
  { value: 'EGI', label: 'Egípcia' },
  { value: 'SCO', label: 'Escocesa' },
  { value: 'ESP', label: 'Espanhola' },
  { value: 'FIN', label: 'Finlandesa' },
  { value: 'FRA', label: 'Francesa' },
  { value: 'GRE', label: 'Grega' },
  { value: 'NLD', label: 'Holandesa' },
  { value: 'HUN', label: 'Húngara' },
  { value: 'IND', label: 'Indiana' },
  { value: 'ING', label: 'Inglesa' },
  { value: 'IRL', label: 'Irlandesa' },
  { value: 'ISR', label: 'Israelense' },
  { value: 'ITA', label: 'Italiana' },
  { value: 'JPN', label: 'Japonesa' },
  { value: 'MEX', label: 'Mexicana' },
  { value: 'NGA', label: 'Nigeriana' },
  { value: 'NOR', label: 'Norueguesa' },
  { value: 'PER', label: 'Peruana' },
  { value: 'POL', label: 'Polonesa' },
  { value: 'POR', label: 'Portuguesa' },
  { value: 'ROM', label: 'Romana' },
  { value: 'RUS', label: 'Russa' },
  { value: 'SUE', label: 'Sueca' },
  { value: 'SUI', label: 'Suíça' },
  { value: 'TUR', label: 'Turca' },
  { value: 'UKR', label: 'Ucraniana' },
];

export const COUNTRIES = [
  { value: 'BRA', label: 'Brasil' },
  { value: 'USA', label: 'Estados Unidos da América' },
  { value: 'UK', label: 'Reino Unido' },
  { value: 'POR', label: 'Portugal' },
];

export const BOOK_LANGUAGES = [
  { value: 'Por', label: 'Português' },
  { value: 'Ing', label: 'Inglês' },
  { value: 'Esp', label: 'Espanhol' },
];

export const BOOK_GENRES = [
  { value: 'Philosophy', label: 'Filosofia' },
  { value: 'History', label: 'História' },
  { value: 'Psychology', label: 'Psicologia' },
  { value: 'Fiction', label: 'Ficção' },
  { value: 'Policy', label: 'Política' },
  { value: 'Technology', label: 'Tecnologia' },
  { value: 'Theology', label: 'Teologia' },
];

export const LITERARY_TYPES = [
  { value: 'book', label: 'Livro' },
  { value: 'collection', label: 'Coletânea' },
  { value: 'magazine', label: 'Revista' },
  { value: 'article', label: 'Artigo' },
  { value: 'essay', label: 'Ensaio' },
];

export const MEDIA_TYPES = [
  { value: 'Dig', label: 'Digital' },
  { value: 'Phi', label: 'Física' },
];

export const READ_STATUS = [
  { value: 'to_read', label: 'Para ler' },
  { value: 'reading', label: 'Lendo' },
  { value: 'read', label: 'Lido' },
  { value: 'paused', label: 'Pausado' },
];
