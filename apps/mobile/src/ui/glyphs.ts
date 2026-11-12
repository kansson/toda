import Add from '@expo/material-symbols/add.xml'
import AddTask from '@expo/material-symbols/add_task.xml'
import ArrowBack from '@expo/material-symbols/arrow_back.xml'
import Check from '@expo/material-symbols/check.xml'
import CheckCircle from '@expo/material-symbols/check_circle.xml'
import ChevronRight from '@expo/material-symbols/chevron_right.xml'
import ClearAll from '@expo/material-symbols/clear_all.xml'
import Close from '@expo/material-symbols/close.xml'
import CloudOff from '@expo/material-symbols/cloud_off.xml'
import CloudUpload from '@expo/material-symbols/cloud_upload.xml'
import ContentCopy from '@expo/material-symbols/content_copy.xml'
import Contrast from '@expo/material-symbols/contrast.xml'
import DateRange from '@expo/material-symbols/date_range.xml'
import Delete from '@expo/material-symbols/delete.xml'
import Devices from '@expo/material-symbols/devices.xml'
import Dns from '@expo/material-symbols/dns.xml'
import DoneAll from '@expo/material-symbols/done_all.xml'
import DragIndicator from '@expo/material-symbols/drag_indicator.xml'
import DriveFileMove from '@expo/material-symbols/drive_file_move.xml'
import Edit from '@expo/material-symbols/edit.xml'
import ErrorIcon from '@expo/material-symbols/error.xml'
import EventUpcoming from '@expo/material-symbols/event_upcoming.xml'
import Flag from '@expo/material-symbols/flag.xml'
import IndentDecrease from '@expo/material-symbols/format_indent_decrease.xml'
import IndentIncrease from '@expo/material-symbols/format_indent_increase.xml'
import History from '@expo/material-symbols/history.xml'
import Info from '@expo/material-symbols/info.xml'
import ArrowDown from '@expo/material-symbols/keyboard_arrow_down.xml'
import ArrowUp from '@expo/material-symbols/keyboard_arrow_up.xml'
import Language from '@expo/material-symbols/language.xml'
import License from '@expo/material-symbols/license.xml'
import List from '@expo/material-symbols/list.xml'
import Logout from '@expo/material-symbols/logout.xml'
import MoreVert from '@expo/material-symbols/more_vert.xml'
import Notes from '@expo/material-symbols/notes.xml'
import Notifications from '@expo/material-symbols/notifications.xml'
import RadioUnchecked from '@expo/material-symbols/radio_button_unchecked.xml'
import Refresh from '@expo/material-symbols/refresh.xml'
import Remove from '@expo/material-symbols/remove.xml'
import Repeat from '@expo/material-symbols/repeat.xml'
import Schedule from '@expo/material-symbols/schedule.xml'
import Search from '@expo/material-symbols/search.xml'
import Settings from '@expo/material-symbols/settings.xml'
import Sort from '@expo/material-symbols/sort.xml'
import Star from '@expo/material-symbols/star.xml'
import SubdirectoryArrow from '@expo/material-symbols/subdirectory_arrow_right.xml'
import SwapHoriz from '@expo/material-symbols/swap_horiz.xml'
import Sync from '@expo/material-symbols/sync.xml'
import TaskAlt from '@expo/material-symbols/task_alt.xml'
import Today from '@expo/material-symbols/today.xml'
import VerticalTop from '@expo/material-symbols/vertical_align_top.xml'
import Widgets from '@expo/material-symbols/widgets.xml'
import CheckCircleFill from '@/assets/symbols/check_circle_fill.xml'
import FilterCancel from '@/assets/symbols/filter_cancel.xml'
import ListFill from '@/assets/symbols/list_fill.xml'
import SettingsFill from '@/assets/symbols/settings_fill.xml'
import StarFill from '@/assets/symbols/star_fill.xml'
import TodayFill from '@/assets/symbols/today_fill.xml'

/** Every icon the app draws, named for what it means rather than how it looks. */
export const glyphs = {
  add: Add,
  addSubtask: SubdirectoryArrow,
  addTask: AddTask,
  allDone: DoneAll,
  back: ArrowBack,
  check: Check,
  clear: Close,
  clearFilters: FilterCancel,
  clearCompleted: ClearAll,
  completed: CheckCircleFill,
  completedOutline: CheckCircle,
  copy: ContentCopy,
  date: Today,
  deadline: Flag,
  delete: Delete,
  devices: Devices,
  drag: DragIndicator,
  drillIn: ChevronRight,
  edit: Edit,
  expand: ArrowDown,
  collapse: ArrowUp,
  history: History,
  indent: IndentIncrease,
  info: Info,
  language: Language,
  license: License,
  list: List,
  listFilled: ListFill,
  leave: Logout,
  more: MoreVert,
  move: DriveFileMove,
  notes: Notes,
  notifications: Notifications,
  offline: CloudOff,
  open: RadioUnchecked,
  outdent: IndentDecrease,
  pending: CloudUpload,
  refresh: Refresh,
  remove: Remove,
  repeat: Repeat,
  search: Search,
  server: Dns,
  settings: Settings,
  settingsFilled: SettingsFill,
  sort: Sort,
  star: Star,
  starFilled: StarFill,
  sync: Sync,
  task: TaskAlt,
  theme: Contrast,
  time: Schedule,
  today: Today,
  todayFilled: TodayFill,
  toTop: VerticalTop,
  turns: SwapHoriz,
  upcoming: EventUpcoming,
  week: DateRange,
  update: Sync,
  warning: ErrorIcon,
  widget: Widgets,
} satisfies Record<string, number>

export type Glyph = keyof typeof glyphs
