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
    	{xtype: 'container', itemId: 'throughputCycleReport', id: 'throughputCycleReport', 
            items: [																					
				{xtype: 'container', itemId: 'cycleTimeContainer', id: 'cycleTimeContainer', title: 'Cycle-Time'},
				{xtype: 'container', itemId: 'throughputContainer', id: 'throughputContainer', title: 'Throughput'}
			],
			layout:{
		        type:'hbox',
		        align:'stretch',
		        padding:5
		    }
		}],
    layout:{
        type:'vbox',
        align:'stretch',
        padding:10
    },
    
    cycleTimeCategoryNames: ["0-5 days", "6-10 days", "11-15 days", "16-20 days", "21-25 days", "26-30 days", "31+ days"],
    cycleTimeDistRange: 5,
    
    getSettingsFields:function()
	{
		return[{
			name:"excludeWeekends",
			xtype:"rallycheckboxfield",
			fieldLabel:"Exclude Weekends from Lead Time"
		}];
	},

	config:{
		defaultSettings:{
		    excludeWeekends:!0
		}
	},
	
    launch: function() {
        
        this._init();
        this._determineDateRangeForThroughput();
        this._createDataStoreForThroughput();
    },
    
    _init: function() {	
		//dynamicItems hold created ui items, which needs to be destroyed before re-drawing
		if (typeof this.dynamicItems === "undefined"){
			this.dynamicItems = {};
		}
				
		if (typeof this.dynamicItems['throughputCycleReport'] === "undefined"){
			this.dynamicItems['throughputCycleReport'] = {};
		}
		else {
			var item;
	
			for (item in this.dynamicItems['throughputCycleReport']) {
				this.dynamicItems['throughputCycleReport'][item].destroy();
			}
		}	
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
                    
                    console.log('spite out Current US coll with defects: ', this.currUserStoriesColl);
	                console.log('spite out previous US data coll with defects: ', this.prevUserStoriesColl);
	                
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
                    
                    this._processStoreData();
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
	
	_processStoreData:  function() {
	    var currThroghtputGridTitle = 'List all User Stories & defects for Current period (Between ' + this.currStartRallyDateFilter + ' & ' + this.currEndRallyDateFilter + ')';
	    var currThroughputDataGrid = this._createThroughputDataGrid(currThroghtputGridTitle, this.currThroughputDataStore);
	    
	    var prevThroghtputGridTitle = 'List all User Stories & defects for Previous period: (Between ' + this.prevStartRallyDateFilter + ' & ' + this.prevEndRallyDateFilter + ')';
	    var prevThroughputDataGrid = this._createThroughputDataGrid(prevThroghtputGridTitle, this.prevThroughputDataStore);
	    
	    var pastRangeThroghtputGridTitle = 'List all User Stories & defects for last 6 Months: (Between ' + this.pastDateSixMonthFilter + ' & ' + this.currEndRallyDateFilter + ')';
	    var pastRangeThroughputDataGrid = this._createThroughputDataGrid(pastRangeThroghtputGridTitle, this.pastRangeThroughputDataStore);
	    
	    var currThroughputMessage = '<div>The Throughput for current period (between ' + this.currStartRallyDateFilter +' & '+ this.currEndRallyDateFilter +') is : <b>' + this.currThroughputValue + '</b></div>';
	    var prevThroughputMessage = '<div>The Throughput for previous period (between ' + this.prevStartRallyDateFilter +' & '+ this.prevEndRallyDateFilter +') is : <b>' + this.prevThroughputValue + '</b></div>';
	    
	    this._createThroghputMessagePanel(currThroughputMessage, prevThroughputMessage);
	    this._processThroughputDataForGraph();
	    this._createThroghputGridPanel(currThroughputDataGrid, prevThroughputDataGrid, pastRangeThroughputDataGrid);
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
		    
		console.log('Spite out the Items: ', this.pastRangeUserStoriesColl);
		Ext.Array.each(this.pastRangeUserStoriesColl, function(record) {
		    that._buildChartData(record);
		});
		
		console.log('chartdata post configuration: ', this.chartData);
		console.log('spite out groupedSeries: ', this.groupedSeries);
		
		this._initAndDrawCharts(this.chartData);
	},
	
	_buildChartData: function(record){
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
	_initAndDrawCharts: function(inputData) {												
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
				
		this._drawHorizontalBarChart(inputData.categories, this.groupedSeries);			
	},
	
	// Configures and displays a horizontal bar chart
	_drawHorizontalBarChart: function(categories, data) {	
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
		
		this._drawBarChart(conf);
	},								
	
	//Draws and displays the bar chart 
	_drawBarChart: function (conf) {					
		var throughputChart = Ext.create('Rally.ui.chart.Chart',{
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
		
		if(this.throughtputGraphContainer){
			this.throughtputGraphContainer.removeAll(true);
			this.throughtputGraphContainer.add(throughputChart);
		}
		else{
				this.throughtputGraphContainer = Ext.create('Ext.container.Container', {
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
	        
	        this.add(this.throughtputGraphContainer);
		}
	},				
	
	_createThroghputMessagePanel: function(currThroughputMessage, prevThroughputMessage){
         var throughtputContainer = Ext.create('Ext.container.Container', {
            layout: {
                type: 'vbox',
                align: 'stretch',
                padding: 5
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
        
        //create the panel for displaying computed Throughput.
        if(this.infoPanel){
            this.infoPanel.removeAll(true);
            this.infoPanel.add(throughtputContainer);
        }
        else{
            this.infoPanel=Ext.create('Ext.form.Panel', {
            	 title: 'Throughput',
                renderTo: Ext.getBody(),
                layout: {
                    type: 'vbox',
                    align: 'stretch',
                    padding: 10
                },
                items: [throughtputContainer]
            });
            
            this.add(this.infoPanel);
        }
	},
	
	_createThroghputGridPanel: function(currThroughputDataGrid, prevThroughputDataGrid, pastRangeThroughputDataGrid){
	    //create the grid panel to display the grid.
        if(this.gridPanel){
            this.gridPanel.removeAll(true);
            this.gridPanel.add(currThroughputDataGrid);
            this.gridPanel.add(prevThroughputDataGrid);
            this.gridPanel.add(pastRangeThroughputDataGrid);
        }
        else{
            
            this.gridPanel=Ext.create('Ext.form.Panel', {
                renderTo: Ext.getBody(),
                title: 'View Details: ',
                layout: {
                    type: 'vbox',
                    align: 'stretch',
                    padding: 10
                },
                items: [currThroughputDataGrid, prevThroughputDataGrid, pastRangeThroughputDataGrid]
            });
            
            this.add(this.gridPanel);
        }
	},
	
	_createThroughputDataGrid: function(title, dataStore){
	    var grid = Ext.create('Rally.ui.grid.Grid', {
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
	}
});
