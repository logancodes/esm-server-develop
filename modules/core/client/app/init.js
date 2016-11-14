'use strict';

//Start by defining the main module and adding the module dependencies
angular.module(ApplicationConfiguration.applicationModuleName, ApplicationConfiguration.applicationModuleVendorDependencies);

// Setting HTML5 Location Mode
angular.module(ApplicationConfiguration.applicationModuleName).config(['$locationProvider', '$httpProvider', 'uiGmapGoogleMapApiProvider',
	function ($locationProvider, $httpProvider, uiGmapGoogleMapApiProvider) {
		$locationProvider.html5Mode(true).hashPrefix('!');

		$httpProvider.interceptors.push('authInterceptor');

		$httpProvider.defaults.cache = false;
		if (!$httpProvider.defaults.headers.get) {
			$httpProvider.defaults.headers.get = {};
		}
		// disable IE ajax request caching
		$httpProvider.defaults.headers.get['If-Modified-Since'] = '0';

		uiGmapGoogleMapApiProvider.configure({
			key: 'AIzaSyCTbJdM2XHNQ6ybqPzyaT-242tIAgIbk8w',
			v: '3.24',
			// libraries: 'weather,geometry,visualization'
		});
	}
]);

angular.module(ApplicationConfiguration.applicationModuleName).run(function ($rootScope, $state, Authentication, _, $cookies, Application, ContextService) {

	// Check authentication before changing state
	$rootScope.$on('$stateChangeStart', function (event, toState, toParams, fromState, fromParams) {
		//console.log('> $stateChangeStart(to = ' +  toState.name + ', from = ' + fromState.name + ')');
		//console.log('> $stateChangeStart');
		//console.log('  toState = ', JSON.stringify(toState));
		//console.log('  toParams = ', JSON.stringify(toParams));
		//console.log('  fromState = ', JSON.stringify(fromState));
		//console.log('  fromParams = ', JSON.stringify(fromParams));
		//
		// for some states just go, no pre-processing
		//
		//console.log('ContextService.synced = ', ContextService.isSynced(toState, toParams));
		if (!!~['authentication.signin','forbidden'].indexOf (toState.name)) {
			return true;
		}
		else {
			if (!ContextService.isSynced(toState, toParams)) {
				//console.log('halt!');
				event.preventDefault();
				ContextService.sync(toState, toParams).then(function(ok) {
					//console.log('sync good, go!');
					if (ContextService.isAllowed(toState.data)) {
						$state.go(toState, toParams);
					} else {
						$state.go('forbidden');
					}
				}, function(bad) {
					//console.log('sync bad...:| ', JSON.stringify(bad));
					return false;
				});
			} else {
				// proceed...
				//console.log('synced... proceed if allowed!');
				if (ContextService.isAllowed(toState.data)) {
					return true;
				} else {
					event.preventDefault();
					$state.go('forbidden');
				}
			}
		}
	});

	// Record previous state
	$rootScope.$on('$stateChangeSuccess', function (event, toState, toParams, fromState, fromParams) {
		document.body.scrollTop = document.documentElement.scrollTop = 0;
		if (!fromState.data || !fromState.data.ignoreState) {
			$state.previous = {
				state: fromState,
				params: fromParams,
				href: $state.href(fromState, fromParams)
			};
		}

	});

	$rootScope.$on('$stateChangeError', console.log.bind(console));

});

//Then define the init function for starting up the application
angular.element(document).ready(function () {
	//Fixing facebook bug with redirect
	if (window.location.hash && window.location.hash === '#_=_') {
		if (window.history && history.pushState) {
			window.history.pushState('', document.title, window.location.pathname);
		} else {
			// Prevent scrolling by storing the page's current scroll offset
			var scroll = {
				top: document.body.scrollTop,
				left: document.body.scrollLeft
			};
			window.location.hash = '';
			// Restore the scroll offset, should be flicker free
			document.body.scrollTop = scroll.top;
			document.body.scrollLeft = scroll.left;
		}
	}

  // make sure we don't have any issues in ie getting the location.origin...
  if (!window.location.origin) {
	window.location.origin = window.location.protocol + "//" +
	  window.location.hostname +
	  (window.location.port ? ':' + window.location.port : '');
  }

	//Then init the app
	angular.bootstrap(document, [ApplicationConfiguration.applicationModuleName]);
});
