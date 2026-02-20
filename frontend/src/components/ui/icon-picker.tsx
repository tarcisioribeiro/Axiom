import {
  Heart,
  BookOpen,
  Dumbbell,
  Utensils,
  Brain,
  Pen,
  Briefcase,
  Gamepad2,
  Users,
  MessageCircle,
  Wallet,
  Home,
  Sparkles,
  MoreHorizontal,
  Sun,
  Moon,
  Coffee,
  Music,
  Camera,
  Palette,
  Globe,
  Target,
  CheckCircle,
  Star,
  Zap,
  Flame,
  Leaf,
  Droplets,
  Wind,
  Mountain,
  Trees,
  Flower2,
  Apple,
  Pill,
  Stethoscope,
  Activity,
  Timer,
  AlarmClock,
  CalendarDays,
  ListTodo,
  GraduationCap,
  Languages,
  Code,
  Laptop,
  Smartphone,
  Headphones,
  Mic,
  Video,
  Film,
  Tv,
  Car,
  Plane,
  Ship,
  Bike,
  PersonStanding,
  Baby,
  Dog,
  Cat,
  Bird,
  Fish,
  Bug,
  Trash2,
  Recycle,
  ShoppingCart,
  CreditCard,
  PiggyBank,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/utils';

import { Button } from './button';
import { Input } from './input';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { ScrollArea } from './scroll-area';

// Map of icon names to icon components
// eslint-disable-next-line react-refresh/only-export-components
export const TASK_ICONS: Record<string, LucideIcon> = {
  // Health & Wellness
  Heart: Heart,
  Pill: Pill,
  Stethoscope: Stethoscope,
  Activity: Activity,

  // Exercise & Fitness
  Dumbbell: Dumbbell,
  PersonStanding: PersonStanding,
  Bike: Bike,
  Mountain: Mountain,

  // Nutrition
  Utensils: Utensils,
  Apple: Apple,
  Coffee: Coffee,
  Droplets: Droplets,

  // Mental & Spiritual
  Brain: Brain,
  Sparkles: Sparkles,
  Sun: Sun,
  Moon: Moon,
  Leaf: Leaf,
  Wind: Wind,
  Flower2: Flower2,

  // Studies & Learning
  BookOpen: BookOpen,
  GraduationCap: GraduationCap,
  Languages: Languages,
  Code: Code,
  Laptop: Laptop,

  // Writing & Creativity
  Pen: Pen,
  Palette: Palette,
  Camera: Camera,
  Music: Music,
  Film: Film,

  // Work
  Briefcase: Briefcase,
  Target: Target,
  TrendingUp: TrendingUp,
  ListTodo: ListTodo,

  // Leisure & Entertainment
  Gamepad2: Gamepad2,
  Headphones: Headphones,
  Tv: Tv,
  Video: Video,
  Mic: Mic,

  // Family & Social
  Users: Users,
  MessageCircle: MessageCircle,
  Baby: Baby,

  // Finance
  Wallet: Wallet,
  CreditCard: CreditCard,
  PiggyBank: PiggyBank,
  ShoppingCart: ShoppingCart,

  // Home & Household
  Home: Home,
  Trash2: Trash2,
  Recycle: Recycle,
  Trees: Trees,

  // Personal Care
  Star: Star,
  CheckCircle: CheckCircle,
  Zap: Zap,
  Flame: Flame,

  // Time & Schedule
  Timer: Timer,
  AlarmClock: AlarmClock,
  CalendarDays: CalendarDays,

  // Travel
  Car: Car,
  Plane: Plane,
  Ship: Ship,
  Globe: Globe,

  // Tech
  Smartphone: Smartphone,

  // Pets
  Dog: Dog,
  Cat: Cat,
  Bird: Bird,
  Fish: Fish,
  Bug: Bug,

  // Other
  MoreHorizontal: MoreHorizontal,
};

// Get icon component by name
// eslint-disable-next-line react-refresh/only-export-components
export function getIconByName(name: string | null | undefined): LucideIcon | null {
  if (!name) return null;
  return TASK_ICONS[name] || null;
}

// Group icons by category for better organization
const ICON_CATEGORIES = {
  Saude: ['Heart', 'Pill', 'Stethoscope', 'Activity'],
  Exercicio: ['Dumbbell', 'PersonStanding', 'Bike', 'Mountain'],
  Nutricao: ['Utensils', 'Apple', 'Coffee', 'Droplets'],
  'Mental/Espiritual': ['Brain', 'Sparkles', 'Sun', 'Moon', 'Leaf', 'Wind', 'Flower2'],
  Estudos: ['BookOpen', 'GraduationCap', 'Languages', 'Code', 'Laptop'],
  Criatividade: ['Pen', 'Palette', 'Camera', 'Music', 'Film'],
  Trabalho: ['Briefcase', 'Target', 'TrendingUp', 'ListTodo'],
  Lazer: ['Gamepad2', 'Headphones', 'Tv', 'Video', 'Mic'],
  Social: ['Users', 'MessageCircle', 'Baby'],
  Financas: ['Wallet', 'CreditCard', 'PiggyBank', 'ShoppingCart'],
  Casa: ['Home', 'Trash2', 'Recycle', 'Trees'],
  Pessoal: ['Star', 'CheckCircle', 'Zap', 'Flame'],
  Tempo: ['Timer', 'AlarmClock', 'CalendarDays'],
  Viagem: ['Car', 'Plane', 'Ship', 'Globe'],
  Tech: ['Smartphone'],
  Pets: ['Dog', 'Cat', 'Bird', 'Fish', 'Bug'],
  Outros: ['MoreHorizontal'],
};

interface IconPickerProps {
  value?: string | null;
  onChange: (value: string | null) => void;
  className?: string;
}

export function IconPicker({ value, onChange, className }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const SelectedIcon = value ? TASK_ICONS[value] : null;

  // Filter icons by search
  const filteredCategories = Object.entries(ICON_CATEGORIES).reduce(
    (acc, [category, icons]) => {
      const filteredIcons = icons.filter(
        (iconName) =>
          iconName.toLowerCase().includes(search.toLowerCase()) ||
          category.toLowerCase().includes(search.toLowerCase())
      );
      if (filteredIcons.length > 0) {
        acc[category] = filteredIcons;
      }
      return acc;
    },
    {} as Record<string, string[]>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-start', className)}
        >
          {SelectedIcon ? (
            <>
              <SelectedIcon className="mr-2 h-4 w-4" />
              {value}
            </>
          ) : (
            <span className="text-muted-foreground">Selecione um icone...</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="border-b p-2">
          <Input
            placeholder="Buscar icone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
        </div>
        <ScrollArea className="h-[320px]">
          <div className="p-2 pr-4">
            {/* Clear option */}
            <Button
              variant="ghost"
              size="sm"
              className="mb-2 w-full justify-start text-muted-foreground"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              <MoreHorizontal className="mr-2 h-4 w-4 opacity-50" />
              Sem icone
            </Button>

            {Object.entries(filteredCategories).map(([category, icons]) => (
              <div key={category} className="mb-3">
                <div className="mb-1 px-2 text-xs font-medium text-muted-foreground">
                  {category}
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {icons.map((iconName) => {
                    const Icon = TASK_ICONS[iconName];
                    return (
                      <Button
                        key={iconName}
                        variant={value === iconName ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-9 w-full p-0"
                        onClick={() => {
                          onChange(iconName);
                          setOpen(false);
                        }}
                        title={iconName}
                      >
                        <Icon className="h-4 w-4" />
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}

            {Object.keys(filteredCategories).length === 0 && (
              <div className="py-4 text-center text-sm text-muted-foreground">
                Nenhum icone encontrado
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
