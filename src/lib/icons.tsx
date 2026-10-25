import {
  Baby,
  Banknote,
  Bike,
  BookOpen,
  Briefcase,
  Bus,
  Car,
  CircleDot,
  Coffee,
  CreditCard,
  Dog,
  Dumbbell,
  Film,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HandCoins,
  HeartPulse,
  Home,
  Landmark,
  Laptop,
  Music,
  Phone,
  PiggyBank,
  Pill,
  Plane,
  Receipt,
  Repeat,
  Scissors,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  TrendingUp,
  Utensils,
  Wallet,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'

export const icons: Record<string, LucideIcon> = {
  wallet: Wallet,
  landmark: Landmark,
  'credit-card': CreditCard,
  'piggy-bank': PiggyBank,
  smartphone: Smartphone,
  banknote: Banknote,
  'hand-coins': HandCoins,
  briefcase: Briefcase,
  laptop: Laptop,
  'trending-up': TrendingUp,
  gift: Gift,
  sparkles: Sparkles,
  utensils: Utensils,
  coffee: Coffee,
  'shopping-basket': ShoppingBasket,
  'shopping-bag': ShoppingBag,
  shirt: Shirt,
  car: Car,
  bus: Bus,
  bike: Bike,
  fuel: Fuel,
  plane: Plane,
  receipt: Receipt,
  zap: Zap,
  wifi: Wifi,
  phone: Phone,
  home: Home,
  wrench: Wrench,
  'heart-pulse': HeartPulse,
  pill: Pill,
  dumbbell: Dumbbell,
  scissors: Scissors,
  gamepad: Gamepad2,
  film: Film,
  music: Music,
  'graduation-cap': GraduationCap,
  'book-open': BookOpen,
  baby: Baby,
  dog: Dog,
  repeat: Repeat,
  'circle-dot': CircleDot,
}

export const iconNames = Object.keys(icons)

export function Icon({ name, className }: { name: string; className?: string }) {
  const Cmp = icons[name] ?? CircleDot
  return <Cmp className={className} />
}

export function IconBadge({
  name,
  color,
  size = 'md',
  className,
}: {
  name: string
  color: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const dims = { sm: 'size-8 rounded-lg', md: 'size-10 rounded-xl', lg: 'size-12 rounded-2xl' }[size]
  const iconDims = { sm: 'size-4', md: 'size-[18px]', lg: 'size-5' }[size]
  return (
    <span
      className={`${dims} ${className ?? ''} grid shrink-0 place-items-center`}
      style={{ background: `${color}1f`, color, boxShadow: `inset 0 0 0 1px ${color}33` }}
    >
      <Icon name={name} className={iconDims} />
    </span>
  )
}
