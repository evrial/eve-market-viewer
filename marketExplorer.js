/*!
 * Sections of code from https://github.com/jimpurbrick/crestexplorerjs
 *  Copyright 2012, CCP (http://www.ccpgames.com)
 *  Dual licensed under the MIT or GPL Version 2 licenses.
 *  http://www.opensource.org/licenses/mit-license.php
 *  http://www.opensource.org/licenses/GPL-2.0
 *
 *  All other code is under the MIT license.
*/
'use strict';

(function($, window, document) {
// Configuration parameters
const CREST_url = 'https://crest-tq.eveonline.com';
const ESI_url = 'https://esi.tech.ccp.is/latest/swagger.json?datasource=tranquility';
let endpoints;
let marketGroups;
let searchObj = [];
let regions = {};  // { (int)id: (obj)region }
let currentRegion = { id: 10000002 };
let presetRegion = 'The Forge';
let presetTypeid = 44992; // PLEX

// Format float in finance format with different precision
function nFormatter(num) {
  if (num >= 1e12) return (num / 1e12).toFixed(2).replace(/\.0*$/, '') + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(1).replace(/\.0*$/, '') + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed().replace(/\.0*$/, '') + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed().replace(/\.0*$/, '') + 'K';
  return num;
}

// Convert an in-game ISK to USD equvalent using PLEX price
// don't take it seriously
function ISKtoUSD(num) {
  return (num / 1e9 * 17.5).toFixed();
}

// Show error message in main data pane.
function displayError(error) {
  $('#data').children().replaceWith(`<span>${error}</span>`);
}

// ajax wait cursor
$(document).ajaxStart(function() {
    $(document.body).addClass('wait');
  }).ajaxStop(function() {
    $(document.body).removeClass('wait');
  });

// initialize swagger client, point to a resource listing
window.client = new SwaggerClient({
    url: ESI_url,
    success: function() {}
  });
// after:
// client.Market.get_markets_region_id_orders({region_id: 10000002, type_id: 42231, order_type: 'all'})

let headers = {
    'Accept': 'application/json, charset=utf-8'
  };
if ($.cookie('language')) {
  headers['Accept-Language'] = $.cookie('language');
}

$.ajaxSetup({
    accepts: 'application/json, charset=utf-8',
    crossDomain: true,
    type: 'GET',
    dataType: 'json',
    headers: headers,
    error: function(xhr, status, error) {
        displayError(error);
      }
  });

function drawChart() {

  client.Market.get_markets_region_id_history(
      { region_id: currentRegion.id, type_id: presetTypeid },
      { responseContentType: 'application/json' },
      function(data) {
          let average = [];
          let highest = [];
          let lowest = [];
          let volume = [];
          let revenue = [];


          for (let i = 0, len = data.obj.length; i < len; i += 1) {
            average.push([Date.parse(data.obj[i].date), data.obj[i].average]);
            highest.push([Date.parse(data.obj[i].date), data.obj[i].highest]);
            lowest.push([Date.parse(data.obj[i].date), data.obj[i].lowest]);
            volume.push([Date.parse(data.obj[i].date), data.obj[i].volume]);
            revenue.push([Date.parse(data.obj[i].date), data.obj[i].volume * data.obj[i].average]);
          }

          var options = {
            chart: {
              renderTo: 'chart'
            },
            rangeSelector: {
                selected: 1
              },
            legend: {
                enabled: true
              },
            credits: {
                enabled: false
              },
            xAxis: {
                type: 'datetime',
                ordinal: false,
              },
            yAxis: [{ // Primary yAxis
                title: {
                    text: 'Price'
                  },
                height: '60%',
                opposite: true
              }, { // Secondary yAxis
                title: {
                    text: 'Revenue'
                  },
                top: '65%',
                height: '35%',
                offset: 0,
                opposite: true
              }, { // Tertiary yAxis
                labels: {
                    align: 'left',
                    x: 0
                  },
                title: {
                    text: 'Volume'
                  },
                top: '65%',
                height: '35%',
                opposite: false
              }],
            series: [{
                name: 'Average',
                data: average,
                tooltip: {
                    valueDecimals: 2,
                    valueSuffix: ' ISK'
                  },
              }, {
                name: 'High',
                data: highest,
                tooltip: {
                    valueDecimals: 2,
                    valueSuffix: ' ISK'
                  }
              }, {
                name: 'Low',
                data: lowest,
                tooltip: {
                    valueDecimals: 2,
                    valueSuffix: ' ISK'
                  }
              }, {
                name: 'Volume',
                type: 'column',
                data: volume,
                yAxis: 2
              }, {
                name: 'Revenue',
                type: 'areaspline',
                data: revenue,
                yAxis: 1,
                tooltip: {
                    valueDecimals: 2,
                    valueSuffix: ' ISK'
                  },
                fillOpacity: 0.3,
                zIndex: 0
              }, {
                name: 'Online players',
                type: 'areaspline',
                yAxis: 2
              }]
          };

          // $.get('http://eve-offline.net/?server=tranquility&callback=?', function(data) {
              // console.log(JSON.parse(data));
              // var el = $( '<div></div>' );
              // el.html(data);
              // console.log(el);
              // options.series[5].data = [];
              // var chart = new Highcharts.stockChart(options);
          // });

          var chart = new Highcharts.stockChart(options);
      }
  );
}

$.urlParam = function(name) {
    const results = new RegExp('[\\?&]' + name + '=([^&#]*)').exec(window.location.href);
    if (results === null) {
      return null;
    } else {
      return results[1] || 0;
    }
  };

function loadEndpoints() {
  $.getJSON(CREST_url, function(data, status, xhr) {
      endpoints = data;
      loadRegions();
      loadMarketGroups();
    });
}

function loadRegions() {
  $.getJSON(endpoints.regions.href, function(data, status, xhr) {
      $.map(data.items, function(value) {
          if ((!value.name.match('.-R00')) || (value.name === 'G-R00031')) {
            $('#regionSelector').append(`<option value='${value.href}'>${value.name}</option>`);
            regions[value.id] = value;
          }
        });
      $(`#regionSelector option:contains('${presetRegion}')`).prop('selected', true);
      $('#regionSelector').selectmenu('refresh');
      loadRegionData();
    });
}

function loadMarketGroups() {
  $.getJSON(endpoints.marketGroups.href, function(data, status, xhr) {
      marketGroups = data.items;
      $.map(marketGroups, function(group) {
          if (typeof group.parentGroup === 'undefined') {
            $('#marketGroups').append(`<li data-cresthref='${group.href}' class='groupLink' title='${group.description}'>${group.name}</li>`);
          }
        });
      $('.groupLink').click(function(event) {
        event.stopPropagation();
        openSubGroup(event.target);
      });
      $('#marketgroupmain').show();
    });
}

function openSubGroup(group) {
  if ($(group).children('ul').length) {
    $(group).children('ul').toggle();
  } else {
    $(group).append('<ul class="subdisplay"></ul>');
    const node = $(group).children('ul');
    let itemcount = 0;

    $.map(marketGroups, function(subgroup) {
      if (typeof subgroup.parentGroup !== 'undefined' && subgroup.parentGroup.href === group.dataset.cresthref) {
        node.append(`<li data-cresthref='${subgroup.href}' class='groupLink' title='${subgroup.description}'>${subgroup.name}</li>`);
      }
      if (subgroup.href === group.dataset.cresthref) {
        $.getJSON(subgroup.types.href, function(data, status, xhr) {
            $.map(data.items, function(item) {
                if (item.marketGroup.href === group.dataset.cresthref) {
                  node.append(`<li data-cresthref='${item.type.href}' class='itemLink'><img width=16 hieght=16 src='${item.type.icon.href}' data-cresthref='${item.type.href}'>${item.type.name}</li>`);
                  itemcount += 1;
                }
              });

            if (itemcount) {
              $('.itemLink').click(function(event) {
                  event.stopPropagation();
                  openItem(event.target.dataset.cresthref);
                });
            }
          });
      }
    });
  }
}

function loadRegionData() {
  if ($('#regionSelector').val() === 'Universe') {
    loadUniverseMarket();
    return;
  }
  $.getJSON($('#regionSelector').val(), function(data, status, xhr) {
      currentRegion = data;
      openItem(`${CREST_url}/inventory/types/${presetTypeid}/`);
      // TODO:
      // openItem(type_id, region_id);
    });
}

function loadUniverseMarket() {
  function getData(url) {
    return $.getJSON(url);  // this returns a "promise"
  }

  let promises = [];
  let results = [];

  $.each(regions, function(idx, region) {
      promises.push(getData(`${CREST_url}/market/${region.id}/orders/sell/?type=${CREST_url}/inventory/types/${presetTypeid}/`));
      promises.push(getData(`${CREST_url}/market/${region.id}/orders/buy/?type=${CREST_url}/inventory/types/${presetTypeid}/`));
    });

  const $buytable = $('#buy').DataTable();
  const $selltable = $('#sell').DataTable();
  $buytable.rows().remove();
  $selltable.rows().remove();

  $.when.apply($, promises).done(function(...args) {
      for (let i = 0; i < args.length; i += 1) {
        const orders = args[i][0].items;
        if (orders.length) {
          results.push(orders);
        }
      }

      $.getJSON(`${CREST_url}/inventory/types/${presetTypeid}/`, function(data, status, xhr) {
          presetTypeid = data.id;
          $('#itemDescription').html(`<h2><img src='https://imageserver.eveonline.com/Type/${data.id}_64.png'>${data.name}</h2><p>${data.description.replace(/[\r\n]+/g, '<br>')}</p>`);

          drawChart();
        });

      $.map(results, function(orderlist) {
          $.map(orderlist, function(item) {
            if (item.buy === true) {
              $buytable.row.add([
                  $('#regionSelector option:selected').text(),
                  item.volume,
                  item.price,
                  item.location.name,
                  item.range,
                  item.minVolume,
                  moment(item.issued).add(item.duration, 'days').fromNow(),
                  moment(item.issued).format('YYYY-MM-DD HH:mm:ss')
              ]);
            } else {
              $selltable.row.add([
                  $('#regionSelector option:selected').text(),
                  item.volume,
                  item.price,
                  item.location.name,
                  moment(item.issued).add(item.duration, 'days').fromNow(),
                  moment(item.issued).format('YYYY-MM-DD HH:mm:ss')
              ]);
            }
          });
        });
      $selltable.draw();
      $buytable.draw();

      try {
        const stateObj = {};
        history.pushState(stateObj, presetTypeid, `?typeid=${presetTypeid}&region=${regionname}`);
      }
      catch (err) {
        console.log('No pushstate');
      }

    });
}

// TODO: ajax table
// https://datatables.net/examples/ajax/custom_data_property.html
// https://datatables.net/reference/api/ajax.reload()
function openItem(typehref) {
  const regionname = $('#regionSelector option:selected').text();
  const buytable = $('#buy').DataTable();
  const selltable = $('#sell').DataTable();
  buytable.rows().remove();
  selltable.rows().remove();
  let buyCap = 0;
  let sellCap = 0;

  $.getJSON(typehref, function(data, status, xhr) {
      $('#itemDescription').html(
          `<h2><img src='https://imageserver.eveonline.com/Type/${data.id}_64.png'>${data.name}</h2><p>${data.description.replace(/[\r\n]+/g, '<br>')}</p>`);

      try {
        history.pushState(null, null, `?typeid=${data.id}&region=${regionname}`);
        presetTypeid = data.id;
        drawChart();
      }
      catch (err) {
        console.log('No pushstate');
      }
    });

  if (typeof currentRegion != 'undefined') {
    $.getJSON(currentRegion.marketSellOrders.href + '?type=' + typehref, function(data, status, xhr) {
        $.map(data.items, function(item) {
            sellCap += item.volume * item.price;
            selltable.row.add([
                currentRegion.name,
                item.volume,
                item.price,
                item.location.name,
                moment(item.issued).add(item.duration, 'days').fromNow(),
                moment(item.issued).format('YYYY-MM-DD HH:mm:ss')
            ]);
          });
        selltable.draw();
        $('#sellCap').text(`Sell ${nFormatter(sellCap)}`).attr('title', '$' + ISKtoUSD(sellCap));
      });

    $.getJSON(currentRegion.marketBuyOrders.href + '?type=' + typehref, function(data, status, xhr) {
        $.map(data.items, function(item) {
            buyCap += item.volume * item.price;
            buytable.row.add([
                currentRegion.name,
                item.volume,
                item.price,
                item.location.name,
                item.range,
                item.minVolume,
                moment(item.issued).add(item.duration, 'days').fromNow(),
                moment(item.issued).format('YYYY-MM-DD HH:mm:ss')
            ]);
          });
        buytable.draw();
        $('#buyCap').text(`Buy ${nFormatter(buyCap)}`).attr('title', '$' + ISKtoUSD(buyCap));
      });
  } else {
    alert('Set a region to get data');
  }
}

function setLanguage() {
  if ($('#language').val() === 'Default') {
    $.removeCookie('language');
  } else {
    $.cookie('language', $('#language').val());
  }
  location.reload();
}

function emptyCache() {
  searchObj = [];
  localStorage.removeItem('searchCache');
  console.log('localStorage empty');
  $('#search').hide();
  $('#emptycache').hide();
  $('#loadcache').show();
}

function loadSearchCache(page=`${CREST_url}/market/types/`) {
  let cachedata = localStorage.getItem('searchCache');
  if (cachedata) {
    try {
      searchObj = JSON.parse(cachedata);
      console.log(`Loaded from localStorage: ${searchObj.length} items, ${cachedata.length} bytes total.`);
    } catch (e) {
      console.log(e);
    }
  } else {
    $.getJSON(page, function(data, status, xhr) {
      // console.log(page);
      // console.log(data.items);
      $.map(data.items, function(item) {
          searchObj.push({
              id: item.type.id,
              href: item.type.href,
              label: item.type.name,
              icon: item.type.icon.href,
              marketid: item.marketGroup.id,
              markethref: item.marketGroup.href
            });
        });
      if (typeof data.next !== 'undefined') {
        loadSearchCache(data.next.href);
      } else {
        cachedata = JSON.stringify(searchObj);
        localStorage.setItem('searchCache', cachedata);
        console.log(`Saved to localStorage: ${searchObj.length} items, ${cachedata.length} bytes total.`);
      }
    });
  }

  $('#loadcache').hide();
  $('#emptycache').show();
  $('#search').show().focus();
  $('#search').autocomplete({
    autoFocus: true,
    minLength: 3,
    delay: 0,
    source: searchObj,
    select: function(event, ui) {
      $('#search').val(ui.item.value);
      openItem(ui.item.href);
    }
  });
}

function doSearch() {
  const searchString = $('#search').val().trim().replace('/', '').toLowerCase();
  $('#marketGroups').hide();
  $('#searchList').empty();
  $('#searchList').show();
  $.map(searchObj, function(item) {
      if (item.label.toLowerCase().match(searchString)) {
        $('#searchList').append(`<li data-cresthref='${item.href}' class='itemLink'><img width=16 height=16 src='${item.icon}' data-cresthref='${item.href}'>${item.label}</li>`);
      }
    });
  $('.itemLink').click(function(event) {
      event.stopPropagation();
      openItem(event.target.dataset.cresthref);
    });
}

$(document).ready(function() {
    loadEndpoints();

    // https://jsfiddle.net/adamboduch/EwwEC/
    $.widget('app.autocomplete', $.ui.autocomplete, {
        _renderItem: function(ul, item) {
            const result = this._super(ul, item);
            result.addClass('ui-menu-item-icon')
                .css('background-image', `url('https://imageserver.eveonline.com/Type/${item.id}_32.png')`);

            return result;
          }
      });
// https://stackoverflow.com/questions/11341379/datatables-sorts-strings-instead-of-numeric
    $('#buy').DataTable({
        'paging': false,
        'scrollY': '40%',
        'bFilter': false,
        'bInfo': false,
        'bAutoWidth': false,
        'bSortClasses': false,
        'bDeferRender': false,
        'sDom': 'C<"clear">lfrtip',
        'order': [[2,'desc']],
        // 'language': {
        //   'decimal': ',',
        //   'thousands': '.'
        // },
        'columnDefs': [
            {
              render: function (data, type, row) {
                return $.number(data);
              },
              targets: [1, 5]
            },
            {
              render: function (data, type, row) {
                return $.number(data, 2);
              },
              targets: [2]
            },
            {className: 'dt-left'},
            {className: 'dt-right'},
            {className: 'dt-right'},
            {className: 'dt-right'},
            {className: 'dt-right'},
            {className: 'dt-right'},
            {className: 'dt-right'}
        ]
      });
    $('#sell').DataTable({
        'paging': false,
        'scrollY': '40%',
        'bFilter': false,
        'bInfo': false,
        'bAutoWidth': false,
        'bSortClasses': false,
        'bDeferRender': false,
        'sDom': 'C<"clear">lfrtip',
        'order': [[2,'asc']],
        // 'language': {
        //   'decimal': ',',
        //   'thousands': '.'
        // },
        'columnDefs': [{
              render: function (data, type, row) {
                return $.number(data);
              },
              targets: [1]
            },
            {
              render: function (data, type, row) {
                return $.number(data, 2);
              },
              targets: [2]
            },
            {className: 'dt-left'},
            {className: 'dt-right'},
            {className: 'dt-right'},
            {className: 'dt-right'},
            {className: 'dt-right'},
            {className: 'dt-right'}
        ]
      });

    $('#searchList').hide();

    if (isFinite($.urlParam('typeid')) && $.urlParam('typeid')) {
      presetTypeid = parseInt($.urlParam('typeid'), 10);
    }

    if ($.urlParam('region')) {
      presetRegion = decodeURIComponent($.urlParam('region'));
    }

    const lang = $.cookie('language');
    $(`#language option[value=${lang}]`).prop('selected', true);

    $('#language').selectmenu({
      change: function(event, ui) {
        setLanguage();
      }
    });
    $('#regionSelector').selectmenu({
      change: function(event, ui) {
        loadRegionData();
      }
    });
    $('#loadcache').click(function() {
        loadSearchCache();
      });
    $('#emptycache').click(function() {
        emptyCache();
      }).hide();
    $('#search').change(function() {
        doSearch();
      }).hide();
    $('#search').click(function() {
      $(this).select();
    });
    $('#dialog').dialog({
        autoOpen: false
      });
    $('#opener').click(function() {
        $('#dialog').dialog('open');
      });
    // $('h2').click(function() {
    //     $(this).next('table').toggle();
    // });
    $(document).tooltip({
      show: { delay: 500 }
    });

  });

}($, window, document));
