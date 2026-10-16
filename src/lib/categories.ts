// 官方分类树（与 www.zawa.uk 前端 site_bundle.js 中的分类常量完全一致）
// 注意：API 只接受英文大类/子类名，格式 "Main / Sub"
export const CATEGORIES: Record<string, string[]> = {
  General: ['Vlog', 'Daily', 'Other', 'Science Popularization', 'Social Science', 'Study', 'Career', 'Lecture'],
  Tech: ['Programming', 'AI', 'Hardware', 'Mobile', 'Cybersecurity', 'Digital', 'Technology Review'],
  Music: ['Original', 'Cover', 'Instrumental', 'MV', 'Live'],
  Games: ['Gameplay', 'Esports', 'Review', 'Mobile Games', 'Indie', 'Single-player', 'Game Mod', 'Game Guide'],
  Life: ['Home', 'Relationships', 'Pets', 'Animal Documentary', 'Pet Life', 'Wildlife', 'Animal Knowledge'],
  Entertainment: ['Reaction', 'Challenge', 'Prank', 'Unboxing', 'Comedy', 'Kichiku'],
  Sports: ['Football', 'Basketball', 'Outdoor', 'Martial Arts', 'Extreme', 'Workout', 'Yoga', 'Nutrition', 'Weight Loss', 'Running'],
  Food: ['Recipe', 'Restaurant', 'Street Food', 'Baking', 'Drinks'],
  Travel: ['City', 'Nature', 'Road Trip', 'International', 'Tips'],
  Fashion: ['Outfit', 'Makeup', 'Skincare', 'Haul', 'Styling'],
  Education: ['Science', 'History', 'Language', 'Math', 'DIY', 'Physics', 'Biology', 'Space', 'Chemistry', 'Engineering', 'Open Class', 'Course Learning', 'Exam Preparation'],
  News: ['World', 'Tech News', 'Finance', 'Politics', 'Environment', 'News Report', 'Hot Topic', 'Social News'],
  Film: ['Short Film', 'Behind the Scenes', 'Documentary', 'Trailer', 'Variety', 'Series', 'Anime Series', 'Comment', 'Film & TV News', 'Original Animation', 'Motion Comic', 'Radio Drama', 'Discussion', 'Cosplay', 'Manga', 'MAD / AMV', 'MMD / 3D', 'Hand-drawn / Dubbing', 'Figure / Model', 'Tokusatsu', 'Anime News'],
  Cars: ['Review', 'Modification', 'Racing', 'EV', 'Maintenance'],
  Art: ['Dance Cover', 'Street Dance', 'China Dance', 'Dance Tutorial', 'Other'],
  Charity: ['Charity Projects', 'Charity Events', 'Public Welfare', 'Charity Records', 'Other'],
};

export const CATEGORY_NAMES = Object.keys(CATEGORIES);

/** "大类 / 子类" */
export function catLabel(main: string, sub?: string): string {
  return sub ? `${main} / ${sub}` : main;
}
export function parseCat(s?: string | null): { main: string; sub: string } {
  if (!s) return { main: 'General', sub: 'Other' };
  const [main, sub] = s.split(' / ').map(x => x.trim());
  return { main: main || 'General', sub: sub || CATEGORIES[main]?.[0] || 'Other' };
}
