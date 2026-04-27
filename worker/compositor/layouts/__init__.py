"""Layout templates — 12 pillar-specific HTML/CSS skeletons."""
from compositor.layouts.earn_hero_badge import render as render_earn_hero_badge
from compositor.layouts.earn_split_stat import render as render_earn_split_stat
from compositor.layouts.earn_full_bleed import render as render_earn_full_bleed
from compositor.layouts.earn_card_stack import render as render_earn_card_stack
from compositor.layouts.grow_device_mockup import render as render_grow_device_mockup
from compositor.layouts.grow_editorial import render as render_grow_editorial
from compositor.layouts.grow_diagonal_split import render as render_grow_diagonal_split
from compositor.layouts.grow_bold_type import render as render_grow_bold_type
from compositor.layouts.shape_portrait_cred import render as render_shape_portrait_cred
from compositor.layouts.shape_multi_grid import render as render_shape_multi_grid
from compositor.layouts.shape_clean_card import render as render_shape_clean_card
from compositor.layouts.shape_photo_frame import render as render_shape_photo_frame

LAYOUT_RENDERERS = {
    "earn_hero_badge": render_earn_hero_badge,
    "earn_split_stat": render_earn_split_stat,
    "earn_full_bleed": render_earn_full_bleed,
    "earn_card_stack": render_earn_card_stack,
    "grow_device_mockup": render_grow_device_mockup,
    "grow_editorial": render_grow_editorial,
    "grow_diagonal_split": render_grow_diagonal_split,
    "grow_bold_type": render_grow_bold_type,
    "shape_portrait_cred": render_shape_portrait_cred,
    "shape_multi_grid": render_shape_multi_grid,
    "shape_clean_card": render_shape_clean_card,
    "shape_photo_frame": render_shape_photo_frame,
}
