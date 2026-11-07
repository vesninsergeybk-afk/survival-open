// Restore open details before scroll so the browser can reach the old position.
const currentSection=root=>root.querySelector('[data-ship-view]')?.dataset.shipView||
 root.querySelector('.skill-branch-tabs [aria-pressed="true"]')?.dataset.id||'';
export function captureHangarView(root){
 return {
  tab:root.querySelector('.base-tabs [aria-selected="true"]')?.dataset.role,
  section:currentSection(root),
  scroll:root.querySelector('.base-dialog')?.scrollTop||0,
  expanded:[...root.querySelectorAll('details[data-hangar-section][open]')]
   .map(node=>node.dataset.hangarSection)
 };
}
export function restoreHangarView(root,view){
 for(const node of root.querySelectorAll('details[data-hangar-section]'))
  node.open=view.expanded.includes(node.dataset.hangarSection);
 const currentTab=root.querySelector('.base-tabs [aria-selected="true"]')?.dataset.role;
 const section=currentSection(root);
 const dialog=root.querySelector('.base-dialog');
 if(dialog)dialog.scrollTop=view.tab===currentTab&&(view.section||'')===section?view.scroll:0;
}
