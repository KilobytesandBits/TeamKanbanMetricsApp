var types = Ext.data.Types; // allow shorthand type access
Ext.define('ThroughputDataModel', {
	extend: 'Ext.data.Model',
	fields: [
                {name: 'FormattedID', mapping: 'FormattedID', type: types.STRING},
                {name: 'Name', mapping: 'Name', type: types.STRING},
                {name: 'AcceptedDate', mapping: 'AcceptedDate', type: types.DATE },
                {name: 'InProgressDate', mapping: 'InProgressDate', type: types.DATE },
                {name: 'Tags', mapping: 'Tags', type: types.STRING},
                {name: 'Owner', mapping: 'Owner', type: types.OBJECT},
                {name: 'CycleTime', mapping: 'CycleTime', type: types.FLOAT},
                {name: 'CycleTimeCategory', mapping: 'CycleTimeCategory', type: types.STRING}
            ]
});

Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    items:[
    	{xtype: 'container', itemId: 'throughputCycleTimeReport', id: 'throughputCycleTimeReport', 
            items: [																					
				{xtype: 'container', itemId: 'throughputContainer', id: 'throughputContainer', title: 'Throughput'},
				{xtype: 'container', itemId: 'cycleTimeContainer', id: 'cycleTimeContainer', title: 'Cycle-Time'}
			],
			layout:{
		        type:'hbox',
		        align:'stretch',
		        padding:10
		    }
		},	
    	{xtype: 'container', itemId: 'WipLimitSLAReport', id: 'WipLimitSLAReport', 
            items: [		
            	{xtype: 'container', itemId: 'wipContainer', id: 'wipContainer', title: 'WIP Limit'},
				{xtype: 'container', itemId: 'slaContainer', id: 'slaContainer', title: 'SLA Counter'}
			],
    		layout:{
		        type:'hbox',
		        align:'stretch',
		        padding:10
		    }
    	}
	],
	
    layout:{
        type:'vbox',
        align:'stretch',
        padding:10
    },
    
    cycleTimeCategoryNames: ["0-5 days", "6-10 days", "11-15 days", "16-20 days", "21-25 days", "26-30 days", "31+ days"],
    cycleTimeDistRange: 5,
	
    launch: function() {
    	
    	this.activeViews = ['throughputCycleTimeReport','WipLimitSLAReport'];
    	this._init();
        this.currThroughputMessage = '<div>The Throughput for current period (between Start Date & End Date) is : <b> 10 </b></div>';
	    this.prevThroughputMessage =  '<div>The Throughput for Previous period (between Start Date & End Date) is : <b> 10 </b></div>';
	    
	    this._determineDateRangeForThroughput();
        
        this._createDataStoreForThroughput();
    },
    
    /* Initializes the app */
	_init: function() {	
		var that = this;
		//dynamicItems hold created ui items, which needs to be destroyed before re-drawing
		if (typeof this.dynamicItems === "undefined"){
			this.dynamicItems = {};
		}
		
		Ext.Array.each(this.activeViews, function(viewName){
			if (typeof that.dynamicItems[viewName] === "undefined"){
				that.dynamicItems[viewName] = {};
			}
			else {
				var item;
		
				for (item in that.dynamicItems[viewName]) {
					that.dynamicItems[viewName][item].destroy();
				}
			}	
		});
	},
	
	 _determineDateRangeForThroughput: function(){
        this.curr_End_Date = new Date();
        
        //Determine a date 30 days prior to current date.
        var tmp_Curr_Date = new Date();
        tmp_Curr_Date.setDate(tmp_Curr_Date.getDate()-30);
        this.curr_Start_Date = tmp_Curr_Date;
        
        this.currStartRallyDateFilter = this.curr_Start_Date.getFullYear() + '-' + (parseInt(this.curr_Start_Date.getMonth(), 10) + 1)  + '-' + this.curr_Start_Date.getDate();
        this.currEndRallyDateFilter = this.curr_End_Date.getFullYear() + '-' + (parseInt(this.curr_End_Date.getMonth(), 10) + 1)  + '-' + this.curr_End_Date.getDate();
        
        var tmp_Prev_Date = new Date();
        tmp_Prev_Date.setDate(tmp_Prev_Date.getDate()-60);
        this.prev_Start_Date = tmp_Prev_Date;
        this.prev_End_Date = Ext.Date.add(this.curr_Start_Date, Ext.Date.DAY, -1);
        
        this.prevStartRallyDateFilter = this.prev_Start_Date.getFullYear() + '-' + (parseInt(this.prev_Start_Date.getMonth(), 10)+1) + '-' + this.prev_Start_Date.getDate();
        this.prevEndRallyDateFilter = this.prev_End_Date.getFullYear() + '-' + (parseInt(this.prev_End_Date.getMonth(), 10)+1) + '-' + this.prev_End_Date.getDate();
        
        this.past_Date_SixMonth = Ext.Date.add(this.curr_Start_Date, Ext.Date.MONTH, -5);
        this.pastDateSixMonthFilter = this.past_Date_SixMonth.getFullYear() + '-' + (parseInt(this.past_Date_SixMonth.getMonth(), 10)+1) + '-' + this.past_Date_SixMonth.getDate();
    }, 
    
     _createDataStoreForThroughput: function(){
        //Determine the data filter for store.
        this.filter = Ext.create('Rally.data.QueryFilter', {
			property: 'AcceptedDate',
			operator: '>=',
			value: this.pastDateSixMonthFilter
		}).and(Ext.create('Rally.data.QueryFilter', {
			property: 'AcceptedDate',
			operator: '<=',
			value: this.currEndRallyDateFilter
		})).and(Ext.create('Rally.data.QueryFilter', {
			property: 'c_KanbanState',
			operator: '=',
			value: 'Accepted'
		}));
		
		//Record all columns that needs to be fetched.
		this.fetchDataColumns = ['FormattedID', 'Name', 'AcceptedDate', 'InProgressDate', 'Tags', 'Owner', 'c_KanbanState'];
		
		//configure the data store context.
		this.contextConfig = {
            workspace: this.getContext().getWorkspace()._Ref,
            project: this.getContext().getProject()._ref,
            projectScopeUp: false,
            projectScopeDown: true,
            limit: 'infinity'
        };
	   
	   //set the sorter config for data store.
	   this.sorterConfig = [{
                        	property: 'AcceptedDate',
                        	direction: 'ASC'
                        },
                        {
                            property: 'FormattedID',
                            direction: 'ASC'
                        }];
                        
		this._createUserStoryDataStore();
    },
    
    _createUserStoryDataStore: function(){
	    var myUserStoryStore = Ext.create('Rally.data.wsapi.Store', {
	        model: 'HierarchicalRequirement',
	        fetch: this.fetchDataColumns,
	        autoLoad: true,
	        context: this.contextConfig,
	        filters: this.filter,
	        sorters: this.sorterConfig,
	        listeners: {
	            load: function(store, data, success){
	            	this.currUserStoriesColl = [];
	                this.prevUserStoriesColl = [];
	                this.pastRangeUserStoriesColl = [];
	                var that = this;
	               
	                Ext.Array.each(data, function(userStory) {
	                    if(userStory && userStory.get('AcceptedDate')){
	                    	if(userStory.get('AcceptedDate') >= that.curr_Start_Date){
	                            that.currUserStoriesColl.push(that._createThroghputData(userStory));
	                        }if(userStory.get('AcceptedDate') < that.curr_Start_Date && userStory.get('AcceptedDate') >= that.prev_Start_Date){
	                            that.prevUserStoriesColl.push(that._createThroghputData(userStory));
	                        }
	                        that.pastRangeUserStoriesColl.push(that._createThroghputData(userStory));
	                    }
	                });
	                
	                this._createDefectStore();
	            },
	            scope: this
	        }
	  });
	},
	
	_createThroghputData: function(rallyObject){
	    var cycleTime = 0;
	    var cycleTimeCat = "N/A";
	    //Determine the cycle time for each object.
	    if(rallyObject.get('AcceptedDate') && rallyObject.get('InProgressDate')){
	        cycleTime = Rally.util.DateTime.getDifference(rallyObject.get('AcceptedDate'), rallyObject.get('InProgressDate'), 'day');
	    }
	    
	    for(var i =0; i<this.cycleTimeCategoryNames.length; i++){
	        var lowerRange = i*this.cycleTimeDistRange, upperRange = lowerRange + 5;
	        
	        if((cycleTime >lowerRange && cycleTime <= upperRange) || (lowerRange === 30 && cycleTime > lowerRange))
	            cycleTimeCat = this.cycleTimeCategoryNames[i];
	    }
	    
	    //Generate the node for throghput data.
	    var data = Ext.create('ThroughputDataModel', {
	        FormattedID: rallyObject.get('FormattedID'), 
	        Name: rallyObject.get('Name'), 
	        AcceptedDate: rallyObject.get('AcceptedDate'), 
	        InProgressDate: rallyObject.get('InProgressDate'), 
	        Tags: rallyObject.get('Tags'), 
	        Owner: rallyObject.get('Owner'),
	        CycleTime: cycleTime,
	        CycleTimeCategory: cycleTimeCat
	    });
	    
	    return data;
	},
	
	_createDefectStore: function(){
	    var that = this;
	    var myDefectStore = Ext.create('Rally.data.wsapi.Store', {
            model: 'Defect',
            fetch: this.fetchDataColumns,
            autoLoad: true,
            context: this.contextConfig,
            filters: this.filter,
            sorters: this.sorterConfig,
            listeners: {
                load: function(store, data, success){
                    Ext.Array.each(data, function(defect){
                        if(defect && defect.get('AcceptedDate')){
                        	if(defect.get('AcceptedDate') >= that.curr_Start_Date){
                            	that._insertRecordInOrder(that.currUserStoriesColl, that._createThroghputData(defect));
                            }if(defect.get('AcceptedDate') < that.curr_Start_Date && defect.get('AcceptedDate') >= that.prev_Start_Date){
                                that._insertRecordInOrder(that.prevUserStoriesColl, that._createThroghputData(defect));
                            }
                            that._insertRecordInOrder(that.pastRangeUserStoriesColl, that._createThroghputData(defect));
                        }
                           
                    });
                    
                   this.currThroughputValue = this.currUserStoriesColl.length;
	               this.prevThroughputValue = this.prevUserStoriesColl.length;
	                
	               this.currThroughputDataStore = Ext.create('Rally.data.custom.Store', {
                        data: this.currUserStoriesColl,
                        pageSize: 100
                    });
                    
                    this.prevThroughputDataStore = Ext.create('Rally.data.custom.Store', {
                        data: this.prevUserStoriesColl,
                        pageSize: 100
                    });
                    
                    this.pastRangeThroughputDataStore = Ext.create('Rally.data.custom.Store', {
                        model: 'ThroughputDataModel',
                        data: this.pastRangeUserStoriesColl,
                        pageSize: 100
                    });
                    
                    this._createThroghputMessagePanel();
                },
                scope: this
            }
	  });
	},
	
	_insertRecordInOrder: function(dataColl, record){
		var closestRecord = record;
		var recordDate = record.get("AcceptedDate");
		
		Ext.Array.each(dataColl, function(data) {
		    var dataDate = data.get("AcceptedDate");
		    if(dataDate && recordDate && dataDate.getMonth() === recordDate.getMonth()){
		    	if(dataDate <= recordDate)
		    		closestRecord = data;
		    }
		});
		
		var dataIndex = dataColl.indexOf(closestRecord);
		if(dataIndex != -1){
			dataColl.splice(dataIndex, 0, record);
		}
		else{
			dataColl.push(record);
		}
	},
    
    _createThroghputMessagePanel: function(){
    	
    	this._configureCycleTimeMetricsContainer('panel1', 'CycleTime', 'cycleTimeContainer', 'throughputCycleTimeReport', true);
    	
	    this._configureThroughputMetricsContainer('panel2', 'Throughput', 'throughputContainer', 'throughputCycleTimeReport', true);
	    
     //   this.currWipLimitMessage = '<div>Work In Progress To be implemented</div>';
	    // this.preWipLimitMessage = '<div>The Avg. CycleTime for previous period (between ' + this.prevStartRallyDateFilter +' & '+ this.prevEndRallyDateFilter +') is : <b> TBI </b></div>';
     //   var wipLimitContainer = this._createMetricsContainer('wipLimit', this.currThroughputMessage, this.prevThroughputMessage);
     //   var pastRangeWipLimitGridTitle = 'View Wip Limit Data';
	    // var pastRangeWipLimitDataGrid = this._createThroughputDataGrid(pastRangeWipLimitGridTitle, this.pastRangeThroughputDataStore, 'wipLimitGrid');
     //   this._configureMetricsContainer('panel3', 'WIP Limit', wipLimitContainer, 'wipContainer', 'WipLimitSLAReport', pastRangeWipLimitDataGrid, false);
        
     //   this.currCycleTimeMessage = '<div>The Avg. CycleTime for current period (between ' + this.currStartRallyDateFilter +' & '+ this.currEndRallyDateFilter +') is : <b> TBI </b></div>';
	    // this.prevCycleTimeMessage = '<div>The Avg. CycleTime for previous period (between ' + this.prevStartRallyDateFilter +' & '+ this.prevEndRallyDateFilter +') is : <b> TBI </b></div>';
     //   var slaLimitContainer = this._createMetricsContainer('slaLimit', this.currThroughputMessage, this.prevThroughputMessage);
     //   var pastRangeSLALimitGridTitle = 'View SLA Limit Data';
	    // var pastRangeSLALimitDataGrid = this._createThroughputDataGrid(pastRangeSLALimitGridTitle, this.pastRangeThroughputDataStore, 'slaLimitGrid');
     //   this._configureMetricsContainer('panel4', 'SLA Limit', slaLimitContainer, 'slaContainer', 'WipLimitSLAReport', pastRangeSLALimitDataGrid, false);
	},
	
	_createThroughputDataGrid: function(title, dataStore, gridId){
		console.log('Data Grid creation................');
		
	    var grid = Ext.create('Rally.ui.grid.Grid', {
	    	id: gridId,
	        title: title,
            store: dataStore,
            bodyBorder: true,
            columnCfgs: [
                {
                   text: 'Formatted ID', dataIndex: 'FormattedID', width: 100
                },
                {
                    text: 'Name', dataIndex: 'Name', width: 500
                },
                {
                    text: 'Accepted Date', dataIndex: 'AcceptedDate', width: 200, emptyCellText: 'No Date',
                    renderer: function(value){
                        if(value)
                            return (value.getFullYear() + '-' + (parseInt(value.getMonth(), 10) + 1)  + '-' + value.getDate());
                    }
                },
                {
                    text: 'InProgress Date', dataIndex: 'InProgressDate', width: 200, emptyCellText: 'No Date',
                    renderer: function(value){
                        if(value)
                            return (value.getFullYear() + '-' + (parseInt(value.getMonth(), 10) + 1)  + '-' + value.getDate());
                    }
                },
                {
                    text: 'Owner', dataIndex: 'Owner', flex: 1, emptyCellText: 'No Owner',
                    renderer: function(value){
                        if(value && value._refObjectName)
                            return value._refObjectName;
                    }
                },
                {
                    text: 'Tags', dataIndex: 'Tags', flex: 1, emptyCellText: 'No Tags',
                    renderer: function(value){
                        if(value && value.Name)
                            return value.Name;
                    }
                },
                {
                    text: 'CycleTime', dataIndex: 'CycleTime', flex: 1
                },
                {
                    text: 'CycleTime Category', dataIndex: 'CycleTimeCategory', flex: 1
                },
             ]
        });
        
        return grid;
	},
	
	_createMetricsContainer: function(containerId, currThroughputMessage, prevThroughputMessage){
		console.log('creating metrics container.......');
		
		var myContainer = Ext.create('Ext.container.Container', {
         	id: containerId,
            layout: {
                type: 'vbox',
                align: 'stretch',
                padding: 15
            },
            renderTo: Ext.getBody(),
            border: 1,
            style: {borderColor:'#000000', borderStyle:'solid', borderWidth:'1px'},
            items: [{
                xtype: 'label',
                html: currThroughputMessage
            },
            {
                xtype: 'label',
                html: prevThroughputMessage
            }]
        });
        
        return myContainer;
	},
	
	_configureMetricsContainer: function(panelId, titleName, throughtputContainer, containerId, reportId, pastRangeDataGrid, hasGraph){
		console.log('start configuring the metrics container.......... for ' + containerId);
		var widthValue = hasGraph? 850 : 600;
		
		if (typeof this.dynamicItems[reportId][panelId] !== 'undefined') {
			this.dynamicItems[reportId][panelId].destroy();
		}
		
		console.log('creating info panel to load message container and grid. for ' + containerId);
		
		var infoPanel=Ext.create('Ext.form.Panel', {
        	id: panelId,
        	title: titleName,
            renderTo: Ext.getBody(),
            width: widthValue,
            height: 300,
            layout: {
                type: 'vbox',
                align: 'stretch',
                padding: 15
            },
            items: [throughtputContainer, pastRangeDataGrid]
        });
        
        this.dynamicItems[reportId][panelId] = Ext.getCmp(containerId).add(infoPanel);
	},
	
	_configureCycleTimeMetricsContainer: function(panelId, titleName, containerId, reportId, hasGraph){
		//1. Create the message panel container for showing the cumulative data.
		this.currCycleTimeMessage = '<div>The Avg. CycleTime for current period (between ' + this.currStartRallyDateFilter +' & '+ this.currEndRallyDateFilter +') is : <b> TBI </b></div>';
	    this.prevCycleTimeMessage = '<div>The Avg. CycleTime for previous period (between ' + this.prevStartRallyDateFilter +' & '+ this.prevEndRallyDateFilter +') is : <b> TBI </b></div>';
		var cycleTimeContainer = this._createMetricsContainer('Cycle Time', this.currCycleTimeMessage, this.prevCycleTimeMessage);
		
		
		//2. Create the throughput graph.
		this._processCycleTimeDataForGraph();
		var cycleTimeGraphContainer = this.cycleTimePieOrBarGraphChart;
		
		//3. cretae the throuput data grid.
		// var pastRangeThroghtputGridTitle = 'View Throughput Data';
	 	// var pastRangeThroughputDataGrid = this._createThroughputDataGrid(pastRangeThroghtputGridTitle, this.pastRangeThroughputDataStore, 'throughputGrid');
		
		//4. cretae the infopanel to add all the above components.
		var widthValue = 600;
		
		if (typeof this.dynamicItems[reportId][panelId] !== 'undefined') {
			this.dynamicItems[reportId][panelId].destroy();
		}
		
		var infoPanel=Ext.create('Ext.form.Panel', {
        	id: panelId,
        	title: titleName,
            renderTo: Ext.getBody(),
            width: widthValue,
            height: 550,
            layout: {
                type: 'vbox',
                align: 'stretch',
                padding: 15
            },
            items: [cycleTimeContainer, cycleTimeGraphContainer]
        });
		
		//5. add the nfopanel to the appropriate app container.
        this.dynamicItems[reportId][panelId] = Ext.getCmp(containerId).add(infoPanel);
	},
	
	_processCycleTimeDataForGraph: function(){
		var that = this;
		
	   this.pieData = {
	   	totalCount: 0, 
	   	months: {},
	   	monthCount: 0,
	   	categories: []
	   };
		
		Ext.Array.each(this.pastRangeUserStoriesColl, function(record) {
			that._buildCycleTimeChartData(record);
		});
		
		this._initAndDrawCycleTimeCharts(this.pieData);
	},
	
	_buildCycleTimeChartData: function(record){
		var pieData = this.pieData;
	    var recAcceptedDate = record.get("AcceptedDate");
	    var recCycleTime = record.get("CycleTime");
	    var recMonthNameCat = Ext.Date.getShortMonthName(recAcceptedDate.getMonth());
	    
	    if(typeof pieData.months[recMonthNameCat] === "undefined"){
	        pieData.months[recMonthNameCat] = {count: 0, avgCycleTime: 0, totalCycleTime: 0, cycletimes: []};
	        pieData.categories.push(recMonthNameCat);
	        
	        pieData.monthCount++;
	    }
	    
	    pieData.months[recMonthNameCat].cycletimes.push(recCycleTime);
	    pieData.months[recMonthNameCat].count++;
	    pieData.months[recMonthNameCat].totalCycleTime = pieData.months[recMonthNameCat].totalCycleTime + recCycleTime;
	    pieData.months[recMonthNameCat].avgCycleTime = Math.ceil(pieData.months[recMonthNameCat].totalCycleTime/ pieData.months[recMonthNameCat].count);
	    pieData.totalCount++;
	   
	   this.pieData = pieData;
	},

	_initAndDrawCycleTimeCharts: function(pieData) {				
		var cycleTimeData = [], sizeData = [], categories = [];
					
		if (pieData.totalCount === 0) {
			return;
		}
		
		for (month in pieData.months){
			cycleTimeData.push([month, pieData.months[month].avgCycleTime]);
			sizeData.push([month, pieData.months[month].count]);
			categories.push(month);
		}
		
		var cycleTimeHorBarGraph = this._drawCycleTimeHorizontalBarChart(categories, cycleTimeData);
		this._createCycleTimeBarGraphContainer(cycleTimeHorBarGraph);
		
		// var cycleTimePie = this._drawPie('cycleTimePie', 'Cycle Time', 'Monthwise Avg. Cycle Time', cycleTimeData, pieData);
		// var bySizePie = this._drawPie('bySizePie', 'Count', 'Monthwise Count', sizeData, pieData);	
		// this._createCycleTimePieContainer(cycleTimePie, bySizePie);
	},
	
	_createCycleTimeBarGraphContainer: function(barGraph){
		
		this.cycleTimePieOrBarGraphChart = Ext.create('Ext.container.Container', {
			    itemId: 'defaultPieChartContainer', 
			    id: 'defaultPieChartContainer',
	            layout: {
	                type: 'hbox',
	                align: 'stretch',
	                padding: 10
	            },
	            renderTo: Ext.getBody(),
	            border: 1,
	            style: {borderColor:'#000000', borderStyle:'solid', borderWidth:'1px'},
	            items: [barGraph]
	        });
	},
	
	//Note: Need to refactor to re-use the same methord for Pie or Bar graph.
	_createCycleTimePieContainer: function(cycleTimePie, bySizePie){
		
		this.cycleTimePieOrBarGraphChart = Ext.create('Ext.container.Container', {
			    itemId: 'defaultPieChartContainer', 
			    id: 'defaultPieChartContainer',
	            layout: {
	                type: 'hbox',
	                align: 'stretch',
	                padding: 10
	            },
	            renderTo: Ext.getBody(),
	            border: 1,
	            style: {borderColor:'#000000', borderStyle:'solid', borderWidth:'1px'},
	            items: [cycleTimePie, bySizePie]
	        });
	},
	
	/* Configures and displays a horizontal bar chart */
	_drawCycleTimeHorizontalBarChart: function(categories, leadTimeData) {	
		var conf = {
			id: 'horizontalBars',
			series: [{name: 'Cycle Time', data: leadTimeData}],	
			chartType: 'bar',
			chartTitle: 'UserStory Cycle Time',
			xAxisCategories: categories,
			xAxisTitle: 'Months',
			yAxisTitle: 'Days',
			_formatLabelsAppendix: ' days',
			plotOptions: {
                bar: {
                    dataLabels: {
                        enabled: this.getSetting('showDataLabels')
                    }
                }
            }
		};										
		
		return this._drawCycleTimeBarChart(conf);
	},
	
	/* Draws and displays the bar chart */
	_drawCycleTimeBarChart: function (conf) {					
		
		var chart = {
			xtype: 'rallychart',
			id: conf.id,
			height: 400,
			width: 550,
			chartData: {
				series: conf.series								
			},
			chartColors: ['#FF3333', '#00CC00'],	
			chartConfig: {														
				chart: {
					plotBackgroundColor: null,
					plotBorderWidth: null,
					plotShadow: false,
					type: conf.chartType																
				},								
				legend: {									
					align: 'right',
					verticalAlign: 'top',
					x: 0,
					y: 100,									
					layout: 'vertical'
				},
				title: {
					text: conf.chartTitle
				},
				tooltip: {
					_formatLabels: function() {
						return '<b>'+ this.series.name +'</b><br/>'+
						this.x +': '+ this.y + conf._formatLabelsAppendix;
					}
				},				
				yAxis: [{
					title: {text: conf.yAxisTitle}
				}],
				xAxis: [{
					title: {text: conf.xAxisTitle},
					categories: conf.xAxisCategories
				}],
				plotOptions: conf.plotOptions
			}
		};
		
		return chart;	
	},
	
	/* Configures and displays a pie chart*/
	_drawPie: function (id, name, text, data, extraData) {	
		
		var chart = {
			xtype: 'rallychart',
			id: id,
			height: 400,
			width: 400,	
			style: {float: 'left'},
			chartData: {
				series: [{
					type: 'pie',
					name: name,
					data: data
				}]
			},
			chartConfig: {							
				chart: {
					plotBackgroundColor: null,
					plotBorderWidth: null,
					plotShadow: false,
					type: 'pie'
				},
				xAxis: {},//must specify empty x-axis due to bug
				title: {
					text: text
				},
				tooltip: {
					pointFormat: '{series.name}: <b>{point.y}</b>',															
					percentageDecimals: 1,
					_formatLabels: function() {															
						return _formatLabels(id, this, extraData);																			
					}
				},
				plotOptions: {
					pie: {
						allowPointSelect: true,
						cursor: 'pointer',
						dataLabels: {
							enabled: true,
							color: '#000000',
							connectorColor: '#000000',									
							_formatLabels: function() {											
								return Rally.getApp()._formatLabels(id, this, extraData);																						
							}
						}
					}
				}
			}
		};
					
		return chart;																		
	},
	
	/* formats lables for charts */
	_formatLabels: function(id, that, extraData) {
		switch (id) {
			case 'cycleTimePie':																										
				return '<b>' + that.point.name +'</b><br/>AVG Cycle Time: '+ that.y;
			case 'bySizePie' :
				return '<b>'+ that.point.name +'</b><br/>Count: '+ that.y; 
		}				
	},
	
	_configureThroughputMetricsContainer: function(panelId, titleName, containerId, reportId, hasGraph){
		
		//1. Create the message panel container for showing the cumulative data.
		this.currThroughputMessage = '<div>The Throughput for current period (between ' + this.currStartRallyDateFilter +' & '+ this.currEndRallyDateFilter +') is : <b>' + this.currThroughputValue + '</b></div>';
	    this.prevThroughputMessage = '<div>The Throughput for previous period (between ' + this.prevStartRallyDateFilter +' & '+ this.prevEndRallyDateFilter +') is : <b>' + this.prevThroughputValue + '</b></div>';
		var throughtputContainer = this._createMetricsContainer('throughput', this.currThroughputMessage, this.prevThroughputMessage);
		
		
		//2. Create the throughput graph.
		this._processThroughputDataForGraph();
		var throughtputGraphContainer = this._createThroughputGraphContainer(this.throughputChart);
		
		//3. cretae the throuput data grid.
		var pastRangeThroghtputGridTitle = 'View Throughput Data';
	    var pastRangeThroughputDataGrid = this._createThroughputDataGrid(pastRangeThroghtputGridTitle, this.pastRangeThroughputDataStore, 'throughputGrid');
		
		//4. cretae the infopanel to add all the above components.
		var widthValue = hasGraph? 850 : 600;
		
		if (typeof this.dynamicItems[reportId][panelId] !== 'undefined') {
			this.dynamicItems[reportId][panelId].destroy();
		}
		
		var infoPanel=Ext.create('Ext.form.Panel', {
        	id: panelId,
        	title: titleName,
            renderTo: Ext.getBody(),
            width: widthValue,
            height: 550,
            layout: {
                type: 'vbox',
                align: 'stretch',
                padding: 15
            },
            items: [throughtputContainer, throughtputGraphContainer]
        });
		
		//5. add the nfopanel to the appropriate app container.
        this.dynamicItems[reportId][panelId] = Ext.getCmp(containerId).add(infoPanel);
	},
	
	_createThroughputGraphContainer: function(throughputChart){
		
		var graphContainer = Ext.create('Ext.container.Container', {
			    itemId: 'defaultChartContainer', 
			    id: 'defaultChartContainer',
	            layout: {
	                type: 'vbox',
	                align: 'stretch',
	                padding: 10
	            },
	            renderTo: Ext.getBody(),
	            border: 1,
	            style: {borderColor:'#000000', borderStyle:'solid', borderWidth:'1px'},
	            items: [throughputChart]
	        });
	     
	    return graphContainer;
	},
	
	_processThroughputDataForGraph: function(){
	    var that = this;
		this.groupedSeries = [];
		
		//initialize the groupseries
	    Ext.Array.each(that.cycleTimeCategoryNames, function(catName) {
	        that.groupedSeries.push({name: catName, data:[], stack: 'qSizes'});
	    });
	    
	    that.groupedSeries.push({name: 'N/A', data: [], stack: 'qSizes'});
	    
	    this.chartData = {
			totalCount: 0,
			months: {},
			monthCount: 0,
			categories: []
		};	
		
		    
		Ext.Array.each(this.pastRangeUserStoriesColl, function(record) {
		    that._buildThroughputChartData(record);
		});
		
		this._initAndDrawThroughputCharts(this.chartData);
	},
	
	_buildThroughputChartData: function(record){
	    var chartData = this.chartData;
	    var recAcceptedDate = record.get("AcceptedDate");
	    var recCycleTimeCat = record.get("CycleTimeCategory");
	    var recMonthNameCat = Ext.Date.getShortMonthName(recAcceptedDate.getMonth());
	    
	    console.log("spite out accepted Month Number: ", recAcceptedDate.getMonth());
	    
	    if(typeof chartData.months[recMonthNameCat] === "undefined"){
	        chartData.months[recMonthNameCat] = {count: 0, monthNum: 0, cycletimes: {}, userStories: []};
	        chartData.categories.push(recMonthNameCat);
	        
	        for(var i=0; i<this.groupedSeries.length; ++i){
	            this.groupedSeries[i].data.push(0); //add 0 for each month
	        }
	        
	        chartData.monthCount++;
	    }
	    
	    chartData.months[recMonthNameCat].userStories.push(record);
	    if(typeof chartData.months[recMonthNameCat].cycletimes[recCycleTimeCat] === 'undefined'){
	        chartData.months[recMonthNameCat].cycletimes[recCycleTimeCat] =0;
	    }
	    
	    chartData.months[recMonthNameCat].cycletimes[recCycleTimeCat]++;
	    chartData.months[recMonthNameCat].count++;
	    chartData.totalCount++;
	  
	    for(var s=0; s<this.groupedSeries.length; ++s){
	        if(recCycleTimeCat === this.groupedSeries[s].name){
	            this.groupedSeries[s].data[(chartData.monthCount -1)] = chartData.months[recMonthNameCat].cycletimes[recCycleTimeCat];
	        }
	    }
	   
	   this.chartData = chartData;
	},
	
	//pre init for the charts 
	_initAndDrawThroughputCharts: function(inputData) {												
		if (inputData.totalCount === 0) {
			return;
		}						
					
		var throughput = [], i, qCount = 0, currTotalCount = 0, avgTotals = [], monthAVGs = [];
						
		for (i in inputData.months) {			
			throughput.push(inputData.months[i].count);
			currTotalCount += inputData.months[i].count;
			qCount++;
					
			avgTotals.push(Math.round(currTotalCount / qCount, 2));
		}
					
		for (i = 0; i < inputData.monthCount; ++i) {
			monthAVGs.push(Math.round(inputData.totalCount / inputData.monthCount, 2));
		}
	
		//Finalize series
		this.groupedSeries.unshift({name: 'Throughput', data: throughput});
		this.groupedSeries.push({type: 'spline',name: 'Moving Average', data: avgTotals, color: 'blue', marker: {lineWidth: 1, fillColor: 'red'}});				
		this.groupedSeries.push({type: 'spline',name: 'Average / Month', data: monthAVGs, color: 'purple', marker: {lineWidth: 1, fillColor: 'red'}});
		this.groupedSeries.push({name: 'Total UserStories: ' + inputData.totalCount, color: '#fff', stack:'blank'});
				
		this._drawThroughputVerticalBarChart(inputData.categories, this.groupedSeries);			
	},
	
	// Configures and displays a horizontal bar chart
	_drawThroughputVerticalBarChart: function(categories, data) {	
		var conf = {
			id: 'verticalBars',
			targetContainer: '#defaultChartContainer',
			series: data,	
			chartType: 'column',
			chartTitle: 'Throughput by Months',
			xAxisCategories: categories,
			xAxisTitle: 'Months',
			yAxisTitle: 'Count'												
		};															
		
		this._drawThroughputBarChart(conf);
	},								
	
	//Draws and displays the bar chart 
	_drawThroughputBarChart: function (conf) {					
		this.throughputChart = Ext.create('Rally.ui.chart.Chart',{
			id: conf.id,
			height: 400,
			chartData: {series: conf.series},							
			chartConfig: {														
				plotOptions: {
					column: {
						stacking: 'normal', 
						cursor: 'pointer',
						point: {
							events: {
								click: function() {															
									//Need to implement
								}
							}
						}										
					}									
				},
				chart: {plotBackgroundColor: null, plotBorderWidth: null, plotShadow: false, type: conf.chartType},								
				legend: {align: 'right', verticalAlign: 'top', x: 0, y: 100,layout: 'vertical'},
				title: {text: conf.chartTitle},
				tooltip: {
					formatter: function() {
						return '<b>'+ this.series.name + ' | ' + this.x + '</b><br/>'+
							'<b>'+ this.y + '</b> User Stories<br/><i>(Click to view User Stories)</i>';
					}
				},				
				yAxis: [{title: {text: conf.yAxisTitle}}],
				xAxis: [{
					title: {text: conf.xAxisTitle},
					categories: conf.xAxisCategories
				}]
			}
		});
	}			
	
});