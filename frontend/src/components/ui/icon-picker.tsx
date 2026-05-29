/* eslint-disable max-lines */
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
  // Saúde
  Thermometer,
  Eye,
  Syringe,
  Smile,
  HeartPulse,
  // Exercício
  Trophy,
  Medal,
  Footprints,
  // Nutrição
  Salad,
  Sandwich,
  Wine,
  Beef,
  // Mental/Espiritual
  Infinity as InfinityIcon,
  CloudSun,
  // Estudos
  FileText,
  Pencil,
  Library,
  Microscope,
  Calculator,
  // Criatividade
  Scissors,
  Wand2,
  Brush,
  // Trabalho
  Clipboard,
  Clock,
  BarChart3,
  Presentation,
  // Lazer
  Puzzle,
  PartyPopper,
  // Tech
  Monitor,
  Keyboard,
  Mouse,
  Wifi,
  Cpu,
  HardDrive,
  // Casa
  Sofa,
  Bed,
  Lightbulb,
  Wrench,
  Hammer,
  // Pessoal
  Award,
  Crown,
  ShieldCheck,
  ThumbsUp,
  // Viagem
  Compass,
  Map,
  Backpack,
  Train,
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
  Thermometer: Thermometer,
  Eye: Eye,
  Syringe: Syringe,
  Smile: Smile,
  HeartPulse: HeartPulse,

  // Exercise & Fitness
  Dumbbell: Dumbbell,
  PersonStanding: PersonStanding,
  Bike: Bike,
  Mountain: Mountain,
  Trophy: Trophy,
  Medal: Medal,
  Footprints: Footprints,

  // Nutrition
  Utensils: Utensils,
  Apple: Apple,
  Coffee: Coffee,
  Droplets: Droplets,
  Salad: Salad,
  Sandwich: Sandwich,
  Wine: Wine,
  Beef: Beef,

  // Mental & Spiritual
  Brain: Brain,
  Sparkles: Sparkles,
  Sun: Sun,
  Moon: Moon,
  Leaf: Leaf,
  Wind: Wind,
  Flower2: Flower2,
  Infinity: InfinityIcon,
  CloudSun: CloudSun,

  // Studies & Learning
  BookOpen: BookOpen,
  GraduationCap: GraduationCap,
  Languages: Languages,
  Code: Code,
  Laptop: Laptop,
  FileText: FileText,
  Pencil: Pencil,
  Library: Library,
  Microscope: Microscope,
  Calculator: Calculator,

  // Writing & Creativity
  Pen: Pen,
  Palette: Palette,
  Camera: Camera,
  Music: Music,
  Film: Film,
  Scissors: Scissors,
  Wand2: Wand2,
  Brush: Brush,

  // Work
  Briefcase: Briefcase,
  Target: Target,
  TrendingUp: TrendingUp,
  ListTodo: ListTodo,
  Clipboard: Clipboard,
  Clock: Clock,
  BarChart3: BarChart3,
  Presentation: Presentation,

  // Leisure & Entertainment
  Gamepad2: Gamepad2,
  Headphones: Headphones,
  Tv: Tv,
  Video: Video,
  Mic: Mic,
  Puzzle: Puzzle,
  PartyPopper: PartyPopper,

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
  Sofa: Sofa,
  Bed: Bed,
  Lightbulb: Lightbulb,
  Wrench: Wrench,
  Hammer: Hammer,

  // Personal Care
  Star: Star,
  CheckCircle: CheckCircle,
  Zap: Zap,
  Flame: Flame,
  Award: Award,
  Crown: Crown,
  ShieldCheck: ShieldCheck,
  ThumbsUp: ThumbsUp,

  // Time & Schedule
  Timer: Timer,
  AlarmClock: AlarmClock,
  CalendarDays: CalendarDays,

  // Travel
  Car: Car,
  Plane: Plane,
  Ship: Ship,
  Globe: Globe,
  Compass: Compass,
  Map: Map,
  Backpack: Backpack,
  Train: Train,

  // Tech
  Smartphone: Smartphone,
  Monitor: Monitor,
  Keyboard: Keyboard,
  Mouse: Mouse,
  Wifi: Wifi,
  Cpu: Cpu,
  HardDrive: HardDrive,

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
  Saúde: [
    'Heart',
    'Pill',
    'Stethoscope',
    'Activity',
    'Thermometer',
    'Eye',
    'Syringe',
    'Smile',
    'HeartPulse',
  ],
  Exercício: [
    'Dumbbell',
    'PersonStanding',
    'Bike',
    'Mountain',
    'Trophy',
    'Medal',
    'Footprints',
  ],
  Nutrição: [
    'Utensils',
    'Apple',
    'Coffee',
    'Droplets',
    'Salad',
    'Sandwich',
    'Wine',
    'Beef',
  ],
  'Mental/Espiritual': [
    'Brain',
    'Sparkles',
    'Sun',
    'Moon',
    'Leaf',
    'Wind',
    'Flower2',
    'Infinity',
    'CloudSun',
  ],
  Estudos: [
    'BookOpen',
    'GraduationCap',
    'Languages',
    'Code',
    'Laptop',
    'FileText',
    'Pencil',
    'Library',
    'Microscope',
    'Calculator',
  ],
  Criatividade: [
    'Pen',
    'Palette',
    'Camera',
    'Music',
    'Film',
    'Scissors',
    'Wand2',
    'Brush',
  ],
  Trabalho: [
    'Briefcase',
    'Target',
    'TrendingUp',
    'ListTodo',
    'Clipboard',
    'Clock',
    'BarChart3',
    'Presentation',
  ],
  Lazer: ['Gamepad2', 'Headphones', 'Tv', 'Video', 'Mic', 'Puzzle', 'PartyPopper'],
  Social: ['Users', 'MessageCircle', 'Baby'],
  Finanças: ['Wallet', 'CreditCard', 'PiggyBank', 'ShoppingCart'],
  Casa: [
    'Home',
    'Trash2',
    'Recycle',
    'Trees',
    'Sofa',
    'Bed',
    'Lightbulb',
    'Wrench',
    'Hammer',
  ],
  Pessoal: [
    'Star',
    'CheckCircle',
    'Zap',
    'Flame',
    'Award',
    'Crown',
    'ShieldCheck',
    'ThumbsUp',
  ],
  Tempo: ['Timer', 'AlarmClock', 'CalendarDays'],
  Viagem: ['Car', 'Plane', 'Ship', 'Globe', 'Compass', 'Map', 'Backpack', 'Train'],
  Tech: ['Smartphone', 'Monitor', 'Keyboard', 'Mouse', 'Wifi', 'Cpu', 'HardDrive'],
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
              <SelectedIcon className="mr-sm h-4 w-4" />
              {value}
            </>
          ) : (
            <span className="text-muted-foreground">Selecione um ícone...</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="border-b p-sm">
          <Input
            placeholder="Buscar icone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
        </div>
        <ScrollArea className="h-[320px]">
          <div className="p-sm pr-md">
            {/* Clear option */}
            <Button
              variant="ghost"
              size="sm"
              className="mb-sm w-full justify-start text-muted-foreground"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              <MoreHorizontal className="mr-sm h-4 w-4 opacity-50" />
              Sem ícone
            </Button>

            {Object.entries(filteredCategories).map(([category, icons]) => (
              <div key={category} className="mb-3">
                <div className="mb-xs px-sm text-xs font-medium text-muted-foreground">
                  {category}
                </div>
                <div className="grid grid-cols-4 gap-xs">
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
              <div className="py-md text-center text-sm text-muted-foreground">
                Nenhum icone encontrado
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
