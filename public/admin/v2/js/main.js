var mlMenu = {

    menuEl: null,

    openMenu: function() {
        classie.add(this.menuEl, 'menu--open');
    },

    closeMenu: function() {
        classie.remove(this.menuEl, 'menu--open');
    },

    init: function(current) {
        console.log('menu.init');
        this.menuEl = document.getElementById('ml-menu');
        this.gridWrapper = document.querySelector('.content');

        new MLMenu(this.menuEl, {
            current: current || 0,
            // breadcrumbsCtrl : true, // show breadcrumbs
            initialBreadcrumb : 'all', // initial breadcrumb text
            backCtrl : true, // show back button
            // itemsDelayInterval : 60, // delay between each menu item sliding animation
            onItemClick: this.loadDummyData.bind(this) // callback: item that doesn´t have a submenu gets clicked - onItemClick([event], [inner HTML of the clicked item])
        });

        // mobile menu toggle
        var openMenuCtrl  = document.querySelector('.action--open'),
            closeMenuCtrl = document.querySelector('.action--close');

        openMenuCtrl.addEventListener('click', this.openMenu.bind(this));
        closeMenuCtrl.addEventListener('click', this.closeMenu.bind(this));
    },

    loadDummyData: function(ev, itemName) {
        ev.preventDefault();
        this.closeMenu();
        var href = $(ev.target).attr('href');
        if(href)
            window.location = href;

        this.gridWrapper.innerHTML = '';
        classie.add(this.gridWrapper, 'content--loading');

        /*
        setTimeout(function() {
            classie.remove(gridWrapper, 'content--loading');
            gridWrapper.innerHTML = '<ul class="products">' + dummyData[itemName] + '<ul>';
        }, 700);
        */
    }

};

Dropzone.autoDiscover = false;
var uploading = false; // image upload status for forms
var uploaded  = [];

var loadImage = function(dropObj, id, prefix) {
    var url = prefix+'system.images/table?limit=1&_id='+id+'&f=';
    var row, data;
    
    $.ajax({
        type: 'GET',
        url: url,
        dataType: 'json',
        success: function(images) {
            if(images && images.rows) {
                for(r in images.rows) {
                    row  = images.rows[r];
                    data = {
                        name: row.name,
                        size: row.bytes,
                        serverId: row._id,
                        accepted: true,
                        status: Dropzone.SUCCESS,
                        url: row.path,
                        upload: {
                            progress: 100, // to fake
                            total: row.bytes, // to fake
                            bytesSent: row.bytes // to fake
                        }
                    };
                    
                    dropObj.files.push(data);
                    dropObj.emit('addedfile', data);
                    dropObj.emit('thumbnail', data, row.path);
                }
            }
        }
    });
}
    
var setFilter = function(filterObj, key, alias, type) {
    filterObj[key] = {
        key   : key,
        name  : alias,
        type  : type,
        opts  : $('.f-'+key+'-opts'),
        field : $('#f-'+key)
    };
}

var depends = function(data, alias) {
    var depObj = {}, depVal;
    
    for(d in data) {
        depVal = data[d];
        
        if( depVal && Object.prototype.toString.call(depVal) != '[object Array]')
            depVal = [depVal];

        depObj['#field-'+d+' select'] = {values: depVal};
    }

    $('#field-'+alias).dependsOn(depObj, {duration: 0});
}

var closeObjectItem = function(obj) {
    $(obj).parent().parent().remove();
}

var addObject = function(obj, object, alias) {
    var index = parseInt($(obj).attr('data-index'));
    var forms = $('#field-'+alias+' .f-arrayOfObjects-forms .row');
    var url   = '/admin/form/'+object+'/'+alias+'/'+index;

    $.ajax({
        type: 'POST',
        url: url,
        success: function(html) {
            forms.append('<div class="col-md-4"><div class="well"><a href="javascript:void(0)" type="button" class="close" aria-label="Close" onclick="closeObjectItem(this);"><span aria-hidden="true">&times;</span></a>'+html+'</div></div>');
            $(obj).attr('data-index', index+1);
        }
    });
}

var loadObject = function(object, alias, id) {
    var button = $('#field-'+alias+' button');
    var url    = '/admin/form/'+object+'/'+alias+'?id='+id;
    var forms  = $('#field-'+alias+' .f-arrayOfObjects-forms .row');
    
    forms.html('<div class="col-md-12"><div class="well">loading...</div></div>');
    
    $.ajax({
        type: 'POST',
        url: url,
        dataType: 'json',
        success: function(resp) {
            button.attr('data-index', resp.index);
            forms.html(resp.html);
        }
    });
}

var getBody = function(bodyItem) {
    return bodyItem.lines;
}

var customTooltips = function(tooltip) {
    // Tooltip Element
    var elId = 'chartjs-tooltip';
    var tooltipEl = document.getElementById(elId);

    if ( ! tooltipEl ) {
        tooltipEl = document.createElement('div');
        tooltipEl.id = elId;
        tooltipEl.className = 'console';
        tooltipEl.innerHTML = '';
        document.body.appendChild(tooltipEl);
    }

    // Hide if no tooltip
    if (tooltip.opacity === 0) {
        tooltipEl.style.opacity = 0;
        return;
    }

    // Set caret Position
    tooltipEl.classList.remove('above', 'below', 'no-transform');
    if (tooltip.yAlign)
        tooltipEl.classList.add(tooltip.yAlign);
    else
        tooltipEl.classList.add('no-transform');

    // Set Text
    if (tooltip.body) {
        var titleLines = tooltip.title || [];
        var bodyLines  = tooltip.body.map(getBody);
        var innerHtml  = '';

        titleLines.forEach(function(title) {
            innerHtml += '<span>'+title+'</span>';
        });

        bodyLines.forEach(function(body, i) {
            innerHtml += ' <span>['+body[0].replace('r: ', '')+']</span>';
        });

        innerHtml += '';

        var tableRoot = tooltipEl.querySelector('table');
        tooltipEl.innerHTML = innerHtml;
    }

    var position = this._chart.canvas.getBoundingClientRect();

    // Display, position, and set styles for font
    tooltipEl.style.opacity = 1;
    tooltipEl.style.left = position.left + tooltip.caretX + 'px';
    tooltipEl.style.top = position.top + tooltip.caretY + 'px';
    tooltipEl.style.fontSize = tooltip.fontSize;
    tooltipEl.style.fontStyle = tooltip._fontStyle;
    tooltipEl.style.padding = tooltip.yPadding + 'px ' + tooltip.xPadding + 'px';
};

var chartConfig = function(labels, data) {
    return {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'r',
                backgroundColor: 'rgba(255,51,102,1)',
                borderWidth: 0,
                data: data
            }]
        },
        options: {
            title: {
                display: false
            },
            legend: {
                display: false
            },
            tooltips: {
                enabled: false,
                mode: 'index',
                position: 'nearest',
                custom: window.customTooltips
            },
            scales: {
                xAxes: [{
                    display: false,
                    barThickness: 4
                }],
                yAxes: [{
                    display: false,
                    ticks: {
                        beginAtZero: true
                    }
                }]
            }
        }
    };
};