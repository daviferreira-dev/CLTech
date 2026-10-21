// Design system da CLTech — specs/003-identidade-visual/spec.md, seção "Design system".
// Nenhum componente daqui faz fetch: os dados continuam vindo dos containers de tela.
export { Button, ButtonLink, buttonClasses, focusRing, textLinkClasses } from "./Button";
export type { ButtonVariant, ButtonSize } from "./Button";
export { Card, CardHeader, CardBody } from "./Card";
export { Input, Select, Textarea, Field } from "./Field";
export { Chip, ChipList } from "./Chip";
export { TagInput } from "./TagInput";
export { Badge, MatchBadge, matchVariant } from "./Badge";
export type { BadgeVariant, MatchState } from "./Badge";
export { Avatar } from "./Avatar";
export { EmptyState, ErrorState, Skeleton, CardListSkeleton, Notice } from "./States";
export { Breadcrumb, Pagination, StageTrail } from "./Navigation";
export type { Crumb, StageTrailItem } from "./Navigation";
