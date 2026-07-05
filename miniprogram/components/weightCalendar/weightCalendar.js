function pad(num) {
  return String(num).padStart(2, '0');
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

Component({
  properties: {
    yearMonth: {
      type: String,
      value: ''
    },
    selectedDate: {
      type: String,
      value: ''
    },
    recordsMap: {
      type: Object,
      value: {}
    }
  },

  data: {
    weeks: ['日', '一', '二', '三', '四', '五', '六'],
    allDays: [],
    days: [],
    yearMonthText: '',
    isMonthExpanded: true,
    dayGridStyle: ''
  },

  observers: {
    'yearMonth, selectedDate, recordsMap': function() {
      this.buildDays();
    }
  },

  lifetimes: {
    attached() {
      this.buildDays();
    }
  },

  methods: {
    getActiveYearMonth() {
      const yearMonth = this.data.yearMonth || formatDate(new Date()).slice(0, 7);
      const parts = yearMonth.split('-');
      return {
        year: Number(parts[0]),
        month: Number(parts[1])
      };
    },

    buildDays() {
      const { year, month } = this.getActiveYearMonth();
      if (!year || !month) return;

      const first = new Date(year, month - 1, 1);
      const total = new Date(year, month, 0).getDate();
      const today = formatDate(new Date());
      const recordsMap = this.data.recordsMap || {};
      const start = new Date(year, month - 1, 1 - first.getDay());
      const gridCount = Math.ceil((first.getDay() + total) / 7) * 7;
      const days = [];

      for (let i = 0; i < gridCount; i += 1) {
        const current = new Date(start);
        current.setDate(start.getDate() + i);
        const date = formatDate(current);
        const isOutsideMonth = current.getFullYear() !== year || current.getMonth() + 1 !== month;
        const record = recordsMap[date] || {};
        days.push({
          key: date,
          date,
          day: current.getDate(),
          weight: record.weight || '',
          empty: false,
          isOutsideMonth,
          isToday: !isOutsideMonth && date === today,
          isSelected: !isOutsideMonth && date === this.data.selectedDate
        });
      }

      this.setData({
        allDays: days,
        days,
        dayGridStyle: '',
        yearMonthText: `${year}年${pad(month)}月`
      });
    },

    onPrev() {
      this.triggerEvent('prev');
    },

    onNext() {
      this.triggerEvent('next');
    },

    onRecords() {
      this.triggerEvent('records');
    },

    onSelect(e) {
      const date = e.currentTarget.dataset.date;
      const { year, month } = this.getActiveYearMonth();
      if (!date || date.indexOf(`${year}-${pad(month)}`) !== 0) return;
      this.triggerEvent('select', { date });
    }
  }
});
