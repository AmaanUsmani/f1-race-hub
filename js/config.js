const CONFIG = {
    API_BASE:     'http://localhost:5001',   // Local FastF1 Flask backend
    JOLPICA_BASE: 'https://api.jolpi.ca/ergast/f1',
    YEAR: new Date().getFullYear(),
    RACE_WEEKEND_DAYS: 4,
    CORS_PROXY: '',  // Not needed — all F1 data goes through the local backend
};

// Keyed by the constructor name Jolpica returns
const TEAM_COLORS = {
    'Red Bull':           '#3671C6',
    'Red Bull Racing':    '#3671C6',
    'Ferrari':            '#E8002D',
    'McLaren':            '#FF8000',
    'Mercedes':           '#27F4D2',
    'Aston Martin':       '#229971',
    'Aston Martin F1 Team': '#229971',
    'Alpine F1 Team':     '#FF87BC',
    'Alpine':             '#FF87BC',
    'Williams':           '#64C4FF',
    'RB F1 Team':         '#6692FF',
    'RB':                 '#6692FF',
    'Racing Bulls':       '#6692FF',
    'Visa Cash App RB':   '#6692FF',
    'Kick Sauber':        '#52E252',
    'Sauber':             '#52E252',
    'Haas F1 Team':       '#B6BABD',
    'Haas':               '#B6BABD',
    'Cadillac':           '#CC0000',
    'Cadillac F1 Team':   '#CC0000',
};

const COUNTRY_FLAGS = {
    'Australia':            '🇦🇺',
    'China':                '🇨🇳',
    'Japan':                '🇯🇵',
    'Bahrain':              '🇧🇭',
    'Saudi Arabia':         '🇸🇦',
    'United States':        '🇺🇸',
    'USA':                  '🇺🇸',
    'Italy':                '🇮🇹',
    'Monaco':               '🇲🇨',
    'Canada':               '🇨🇦',
    'Spain':                '🇪🇸',
    'Austria':              '🇦🇹',
    'United Kingdom':       '🇬🇧',
    'Hungary':              '🇭🇺',
    'Belgium':              '🇧🇪',
    'Netherlands':          '🇳🇱',
    'Singapore':            '🇸🇬',
    'Mexico':               '🇲🇽',
    'Brazil':               '🇧🇷',
    'United Arab Emirates': '🇦🇪',
    'Qatar':                '🇶🇦',
    'Azerbaijan':           '🇦🇿',
};

const TYRE_COLORS = {
    SOFT:         '#FF1801',
    MEDIUM:       '#FFD700',
    HARD:         '#E8E8E8',
    INTERMEDIATE: '#39B54A',
    WET:          '#0067FF',
};

const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

// Team logos from Formula1.com CDN — keyed by Jolpica constructor name variants
const TEAM_LOGOS = {
    'Alpine':               'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/v1740000001/common/f1/2026/alpine/2026alpinelogowhite.webp',
    'Alpine F1 Team':       'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/v1740000001/common/f1/2026/alpine/2026alpinelogowhite.webp',
    'Aston Martin':         'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/v1740000001/common/f1/2026/astonmartin/2026astonmartinlogowhite.webp',
    'Aston Martin F1 Team': 'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/v1740000001/common/f1/2026/astonmartin/2026astonmartinlogowhite.webp',
    'Audi':                 'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/v1740000001/common/f1/2026/audi/2026audilogowhite.webp',
    'Kick Sauber':          'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/v1740000001/common/f1/2026/audi/2026audilogowhite.webp',
    'Sauber':               'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/v1740000001/common/f1/2026/audi/2026audilogowhite.webp',
    'Cadillac':             'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/v1740000001/common/f1/2026/cadillac/2026cadillaclogowhite.webp',
    'Cadillac F1 Team':    'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/v1740000001/common/f1/2026/cadillac/2026cadillaclogowhite.webp',
    'Ferrari':              'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/v1740000001/common/f1/2026/ferrari/2026ferrarilogowhite.webp',
    'Haas':                 'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/v1740000001/common/f1/2026/haasf1team/2026haasf1teamlogowhite.webp',
    'Haas F1 Team':         'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/v1740000001/common/f1/2026/haasf1team/2026haasf1teamlogowhite.webp',
    'McLaren':              'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/v1740000001/common/f1/2026/mclaren/2026mclarenlogowhite.webp',
    'Mercedes':             'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/v1740000001/common/f1/2026/mercedes/2026mercedeslogowhite.webp',
    'Racing Bulls':         'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/v1740000001/common/f1/2026/racingbulls/2026racingbullslogowhite.webp',
    'RB':                   'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/v1740000001/common/f1/2026/racingbulls/2026racingbullslogowhite.webp',
    'RB F1 Team':           'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/v1740000001/common/f1/2026/racingbulls/2026racingbullslogowhite.webp',
    'Visa Cash App RB':     'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/v1740000001/common/f1/2026/racingbulls/2026racingbullslogowhite.webp',
    'Red Bull':             'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/v1740000001/common/f1/2026/redbullracing/2026redbullracinglogowhite.webp',
    'Red Bull Racing':      'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/v1740000001/common/f1/2026/redbullracing/2026redbullracinglogowhite.webp',
    'Williams':             'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/v1740000001/common/f1/2026/williams/2026williamslogowhite.webp',
};

// Driver headshots from Formula1.com CDN — keyed by Jolpica 3-letter driver code
const DRIVER_IMAGES = {
    ALB: 'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/williams/alealb01/2026williamsalealb01right.webp',
    ALO: 'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/astonmartin/feralo01/2026astonmartinferalo01right.webp',
    ANT: 'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/mercedes/andant01/2026mercedesandant01right.webp',
    BEA: 'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/haasf1team/olibea01/2026haasf1teamolibea01right.webp',
    BOR: 'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/audi/gabbor01/2026audigabbor01right.webp',
    BOT: 'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/cadillac/valbot01/2026cadillacvalbot01right.webp',
    COL: 'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/alpine/fracol01/2026alpinefracol01right.webp',
    GAS: 'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/alpine/piegas01/2026alpinepiegas01right.webp',
    HAD: 'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/redbullracing/isahad01/2026redbullracingisahad01right.webp',
    HAM: 'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/ferrari/lewham01/2026ferrarilewham01right.webp',
    HUL: 'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/audi/nichul01/2026audinichul01right.webp',
    LAW: 'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/racingbulls/lialaw01/2026racingbullslialaw01right.webp',
    LEC: 'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/ferrari/chalec01/2026ferrarichalec01right.webp',
    LIN: 'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/racingbulls/arvlin01/2026racingbullsarvlin01right.webp',
    NOR: 'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/mclaren/lannor01/2026mclarenlannor01right.webp',
    OCO: 'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/haasf1team/estoco01/2026haasf1teamestoco01right.webp',
    PER: 'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/cadillac/serper01/2026cadillacserper01right.webp',
    PIA: 'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/mclaren/oscpia01/2026mclarenoscpia01right.webp',
    RUS: 'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/mercedes/georus01/2026mercedesgeorus01right.webp',
    SAI: 'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/williams/carsai01/2026williamscarsai01right.webp',
    STR: 'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/astonmartin/lanstr01/2026astonmartinlanstr01right.webp',
    VER: 'https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/redbullracing/maxver01/2026redbullracingmaxver01right.webp',
};
