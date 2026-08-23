/* eslint-disable max-lines */
import {
  HeartIcon as Heart,
  BookOpenIcon as BookOpen,
  FireIcon as Dumbbell,
  CakeIcon as Utensils,
  LightBulbIcon as Brain,
  PencilSquareIcon as Pen,
  BriefcaseIcon as Briefcase,
  PuzzlePieceIcon as Gamepad2,
  UsersIcon as Users,
  ChatBubbleLeftEllipsisIcon as MessageCircle,
  WalletIcon as Wallet,
  HomeIcon as Home,
  SparklesIcon as Sparkles,
  EllipsisHorizontalIcon as MoreHorizontal,
  SunIcon as Sun,
  MoonIcon as Moon,
  CakeIcon as Coffee,
  MusicalNoteIcon as Music,
  CameraIcon as Camera,
  SwatchIcon as Palette,
  GlobeAltIcon as Globe,
  ViewfinderCircleIcon as Target,
  CheckCircleIcon as CheckCircle,
  StarIcon as Star,
  BoltIcon as Zap,
  FireIcon as Flame,
  SparklesIcon as Leaf,
  BeakerIcon as Droplets,
  CloudIcon as Wind,
  MapPinIcon as Mountain,
  SparklesIcon as Trees,
  SparklesIcon as Flower2,
  CakeIcon as Apple,
  BeakerIcon as Pill,
  BeakerIcon as Stethoscope,
  BoltIcon as Activity,
  ClockIcon as Timer,
  ClockIcon as AlarmClock,
  CalendarDaysIcon as CalendarDays,
  ListBulletIcon as ListTodo,
  AcademicCapIcon as GraduationCap,
  LanguageIcon as Languages,
  CodeBracketIcon as Code,
  ComputerDesktopIcon as Laptop,
  DevicePhoneMobileIcon as Smartphone,
  MusicalNoteIcon as Headphones,
  MicrophoneIcon as Mic,
  VideoCameraIcon as Video,
  FilmIcon as Film,
  TvIcon as Tv,
  TruckIcon as Car,
  PaperAirplaneIcon as Plane,
  TruckIcon as Ship,
  TruckIcon as Bike,
  UserIcon as PersonStanding,
  UserIcon as Baby,
  HandRaisedIcon as Dog,
  FaceSmileIcon as Cat,
  CloudIcon as Bird,
  BeakerIcon as Fish,
  BugAntIcon as Bug,
  TrashIcon as Trash2,
  ArrowPathIcon as Recycle,
  ShoppingCartIcon as ShoppingCart,
  CreditCardIcon as CreditCard,
  BanknotesIcon as PiggyBank,
  ArrowTrendingUpIcon as TrendingUp,
  BeakerIcon as Thermometer,
  EyeIcon as Eye,
  BeakerIcon as Syringe,
  FaceSmileIcon as Smile,
  HeartIcon as HeartPulse,
  TrophyIcon as Trophy,
  TrophyIcon as Medal,
  MapPinIcon as Footprints,
  CakeIcon as Salad,
  CakeIcon as Sandwich,
  CakeIcon as Wine,
  CakeIcon as Beef,
  ArrowPathRoundedSquareIcon as InfinityIcon,
  CloudIcon as CloudSun,
  DocumentTextIcon as FileText,
  PencilIcon as Pencil,
  BuildingLibraryIcon as Library,
  BeakerIcon as Microscope,
  CalculatorIcon as Calculator,
  ScissorsIcon as Scissors,
  SparklesIcon as Wand2,
  PaintBrushIcon as Brush,
  ClipboardIcon as Clipboard,
  ClockIcon as Clock,
  ChartBarSquareIcon as BarChart3,
  PresentationChartBarIcon as Presentation,
  PuzzlePieceIcon as Puzzle,
  SparklesIcon as PartyPopper,
  ComputerDesktopIcon as Monitor,
  CommandLineIcon as Keyboard,
  CursorArrowRaysIcon as Mouse,
  WifiIcon as Wifi,
  CpuChipIcon as Cpu,
  ServerStackIcon as HardDrive,
  HomeModernIcon as Sofa,
  HomeModernIcon as Bed,
  LightBulbIcon as Lightbulb,
  WrenchIcon as Wrench,
  WrenchScrewdriverIcon as Hammer,
  TrophyIcon as Award,
  StarIcon as Crown,
  ShieldCheckIcon as ShieldCheck,
  HandThumbUpIcon as ThumbsUp,
  GlobeAltIcon as Compass,
  MapIcon as Map,
  ShoppingBagIcon as Backpack,
  TruckIcon as Train,
} from '@heroicons/react/24/solid';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import type { IconComponent } from '@/types/icon';

import { Button } from './button';
import { Input } from './input';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { ScrollArea } from './scroll-area';

// Map of icon names to icon components
// eslint-disable-next-line react-refresh/only-export-components
export const TASK_ICONS: Record<string, IconComponent> = {
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
export function getIconByName(name: string | null | undefined): IconComponent | null {
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
  const { t } = useTranslation();
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
            <span className="text-muted-foreground">
              {t('common.iconPicker.placeholder')}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-sm border-b">
          <Input
            placeholder={t('common.iconPicker.searchPlaceholder')}
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
              className="mb-sm text-muted-foreground w-full justify-start"
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
                <div className="mb-xs px-sm text-muted-foreground text-xs font-medium">
                  {category}
                </div>
                <div className="gap-xs grid grid-cols-4">
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
              <div className="py-md text-muted-foreground text-center text-sm">
                Nenhum icone encontrado
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
