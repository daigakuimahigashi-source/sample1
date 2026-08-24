(() => {
  'use strict';

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once:true });
  } else {
    apply();
  }

  function apply() {
    if (document.getElementById('shift-v2-master-typography-style')) return;
    const style = document.createElement('style');
    style.id = 'shift-v2-master-typography-style';
    style.textContent = `
      /* Employee master: match the readable typography used by Staff Skill Lv. */
      #view-master{font-size:11px}

      #view-master .master-title{font-size:15px!important;font-weight:900!important;color:#101828!important}
      #view-master .master-sub{font-size:11px!important;line-height:1.5!important;color:#667085!important}

      #view-master .master-metric small{font-size:10px!important}
      #view-master .master-metric strong{font-size:18px!important;font-weight:900!important}
      #view-master .master-metric span{font-size:10px!important}

      #view-master .master-toolbar,
      #view-master .master-toolbar input,
      #view-master .master-toolbar select,
      #view-master .master-check{font-size:11px!important}
      #view-master .skill-legend{font-size:10px!important}
      #view-master .skill-legend-item{font-size:10px!important}
      #view-master .skill-legend-item b{font-size:10px!important}

      #view-master .master-table{font-size:11px!important}
      #view-master .master-table th{font-size:11px!important;font-weight:900!important;padding-top:9px!important;padding-bottom:9px!important}
      #view-master .master-table td{font-size:11px!important;padding-top:7px!important;padding-bottom:7px!important}

      /* Employee list owns its vertical scroll so the column names can stay fixed. */
      #view-master .master-table-wrap{
        max-height:calc(100vh - 285px)!important;
        min-height:260px!important;
        height:auto!important;
        overflow:auto!important;
        position:relative!important;
        overscroll-behavior:contain;
      }
      #view-master .master-table thead th{
        position:sticky!important;
        top:0!important;
        z-index:40!important;
        background:#fff!important;
        box-shadow:0 1px 0 #d0d5dd,0 5px 10px rgba(16,24,40,.05)!important;
      }

      #view-master .employee-col{min-width:270px!important;width:270px!important}
      #view-master .employee-button{
        display:flex!important;
        align-items:center!important;
        gap:10px!important;
        min-height:30px!important;
        white-space:nowrap!important;
      }
      #view-master .employee-button strong{
        display:inline!important;
        font-size:12px!important;
        font-weight:900!important;
        line-height:1.35!important;
        color:#101828!important;
      }
      #view-master .employee-button span{
        display:inline!important;
        margin:0!important;
        font-size:11px!important;
        font-weight:500!important;
        line-height:1.35!important;
        color:#475467!important;
      }
      #view-master .employee-button em{
        font-size:10px!important;
        font-weight:800!important;
      }

      #view-master .employment-chip{
        font-size:11px!important;
        font-weight:800!important;
        padding:4px 7px!important;
      }
      #view-master .pay-type,
      #view-master .affiliation-sub{
        font-size:10px!important;
        line-height:1.4!important;
        color:#667085!important;
      }
      #view-master .master-table td:nth-child(3)>strong{
        font-size:11px!important;
        font-weight:800!important;
        color:#344054!important;
      }

      #view-master .skill-head{min-width:105px!important}
      #view-master .skill-cell{min-width:105px!important}
      #view-master .skill-level{width:96px!important;padding:5px 6px!important}
      #view-master .skill-level b{font-size:11px!important}
      #view-master .skill-level span{font-size:10px!important;font-weight:800!important}
      #view-master .auto-chip{font-size:10px!important;font-weight:900!important;padding:6px 9px!important}

      #view-master .master-section-tab{font-size:11px!important}
      #view-master .btn{font-size:11px!important}

      @media(max-width:900px){
        #view-master .employee-col{min-width:240px!important;width:240px!important}
        #view-master .master-table-wrap{max-height:calc(100vh - 250px)!important}
      }
    `;
    document.head.appendChild(style);
  }
})();
