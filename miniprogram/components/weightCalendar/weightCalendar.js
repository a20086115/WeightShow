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
    days: [],
    yearMonthText: ''
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
    buildDays() {
      const yearMonth = this.data.yearMonth || formatDate(new Date()).slice(0, 7);
      const parts = yearMonth.split('-');
      const year = Number(parts[0]);
      const month = Number(parts[1]);
      if (!year || !month) return;

      const first = new Date(year, month - 1, 1);
      const total = new Date(year, month, 0).getDate();
      const today = formatDate(new Date());
      const recordsMap = this.data.recordsMap || {};
      const days = [];

      for (let i = 0; i < first.getDay(); i += 1) {
        days.push({ key: `empty-${i}`, empty: true });
      }

      for (let day = 1; day <= total; day += 1) {
        const date = `${year}-${pad(month)}-${pad(day)}`;
        const record = recordsMap[date] || {};
        days.push({
          key: date,
          date,
          day,
          weight: record.weight || '',
          empty: false,
          isToday: date === today,
          isSelected: date === this.data.selectedDate
        });
      }

      this.setData({
        days,
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
      if (!date) return;
      this.triggerEvent('select', { date });
    }
  }
});
