angular.module('adage.gene.searchMany', [
  'adage.gene.resource',
  'adage.gene.utils',
  'adage.gene.selected'
])

.config(function($stateProvider) {
  $stateProvider
    .state('gene_search', {
      url: '/gene_search',
      views: {
        'main': {
          templateUrl: 'gene/gene-network.tpl.html',
          controller: ['$scope', 'UserFactory',
            function($scope, UserFactory) {
              $scope.userObj = null;
              UserFactory.getPromise().$promise.then(function() {
                $scope.userObj = UserFactory.getUser();
              });

              // TODO: Right now, we are hard-coding this organism
              // as Pseudomonas (since it is the only one currently
              // supported by ADAGE). However, as we incorporate
              // multi-species support, this organism will have to
              // be obtained from the ML model. This is the same as
              // the issue in geneSearchForm (also with $scope.organism).
              $scope.organism = 'Pseudomonas aeruginosa';
            }
          ]
        }
      },
      data: {
        pageTitle: 'Gene Search'
      }
    })
  ;
})

.factory('SearchResults', ['$rootScope', 'Gene', function($rootScope, Gene) {
  var queries = [];
  var searchResults = {};
  var searchSuccess = null;

  return {
    getQueries: function() {
      return queries;
    },
    getQueryResults: function(query) {
      return searchResults[query];
    },
    getSearchResults: function() {
      return searchResults;
    },
    getSearchSuccess: function() {
      return searchSuccess;
    },
    remove: function(query) { // Remove a query and its associated result
      queries = queries.filter(function(el) {
        return el !== query;
      });
      delete searchResults[query];
      $rootScope.$broadcast('results.update');
    },
    clear: function() { // Clear the service
      queries = [];
      searchResults = {};
      $rootScope.$broadcast('results.update');
    },
    size: function() {
      return queries.length;
    },
    search: function(qparams) {
      // Gene.search will query for all of the search terms in qparams
      // returning a list of objects containing each search term and the
      // gene results for that term in each objects. If the search
      // contained terms already found in our cache of searchResults,
      // those results are ignored while terms not already present will
      // be added to the cache.
      Gene.search(qparams,
        function(data) {
          var previousQueries = queries.length;
          for (var i = 0; i < data.length; i++) {
            var query = data[i].search;
            if (!searchResults[query]) {
              // If search term didn't already exist
              searchResults[query] = data[i]; // add it to the results
              queries.push(query); // add to the list of queries
            }
          }
          if (previousQueries !== queries.length) {
            $rootScope.$broadcast('results.update');
          }
          searchSuccess = true;
          $rootScope.$broadcast('results.searchResultsReturned');
        },
        function(responseObject, responseHeaders) {
          searchSuccess = false;
          $rootScope.$broadcast('results.searchResultsReturned');
        }
      );
    }
  };
}])


// Directive for whole gene search form
.directive('geneSearchForm', ['SearchResults', function(SearchResults) {
  return {
    controller: ['$scope', '$rootScope', 'SearchResults',
      function($scope, $rootScope, SearchResults) {
        $scope.loadingSearchResults = false;

        // Clear any existing search results
        SearchResults.clear();
        $scope.errors = null;

        $scope.searchGenes = function() {
          if (!$scope.genesToAdd) { // if the query is empty
            return false;
          }
          $scope.loadingSearchResults = true;

          $rootScope.$broadcast('results.loadingSearchResults');

          var qparams = {
            'query': $scope.genesToAdd.query
          };

          if ($scope.organism) {
            // TODO: adage doesn't currently support multiple organisms.
            // Therefore, when retrieving gene objects from the API gene
            // search endpoint, this will return *all* gene objects it finds,
            // without filtering for organism. At the point when we add
            // genes for more than one species to the database, we will
            // need to set this $scope.organism to whatever organism is in
            // the ML model (or genes for many organisms will be returned).
            qparams['organism'] = $scope.organism;
          }
          SearchResults.search(qparams);
        };

        $scope.$on('results.searchResultsReturned', function() {
          $scope.loadingSearchResults = false;
          var searchSuccess = SearchResults.getSearchSuccess();
          if (searchSuccess === null || searchSuccess === false) {
            $scope.errors = 'Gene search is temporarily down';
          } else {
            $scope.errors = null;
          }
        });
      }
    ],
    replace: true,
    restrict: 'E',
    scope: {
      query: '@'
    },
    templateUrl: 'gene/searchMany/gene-search-form.tpl.html'
  };
}])

// Directive for table containing search results
.directive('searchResultTable', ['SearchResults', 'CommonGeneFuncts',
  function(SearchResults, CommonGeneFuncts) {
    return {
      controller: ['$scope', 'SearchResults', 'SelectedGenesFactory',
        function($scope, SearchResults, SelectedGenesFactory) {
          $scope.currentPage = 1;
          $scope.itemsPerPage = 10;
          $scope.totalResults = 0;
          $scope.maxSize = 10;
          $scope.resultsForPage = [];
          $scope.searchResults = SearchResults.getSearchResults();
          $scope.loadingSearchResults = false;

          $scope.addAllNonAmbiguous = function() {
            // Function to automatically add all genes that
            // only have one search result.
            var searchResults = SearchResults.getSearchResults();

            var searchResultKeys = Object.keys(searchResults);

            for (var i = 0; i < searchResultKeys.length; i++) {
              var key = searchResultKeys[i];
              var results = searchResults[key];

              if (results.found.length <= 1) {
                if (results.found[0]) {
                  SelectedGenesFactory.addGene(results.found[0]);
                  SearchResults.remove(key);
                }
              }
            }
          };

          $scope.removeNotFound = function() {
            // Function to get rid of all the queries that returned no results.
            var searchResults = SearchResults.getSearchResults();

            var searchResultKeys = Object.keys(searchResults);

            for (var i = 0; i < searchResultKeys.length; i++) {
              var key = searchResultKeys[i];
              var results = searchResults[key];

              if (results.found.length === 0) {
                SearchResults.remove(key);
              }
            }
          };
        }
      ],

      link: function(scope, element, attr) {
        scope.$on('results.update', function() {
          scope.totalResults = SearchResults.size();
          scope.resultsForPage = CommonGeneFuncts.updatePageGenes(
            scope, SearchResults);
        });

        scope.$on('results.loadingSearchResults', function() {
          scope.loadingSearchResults = true;
        });

        scope.$on('results.searchResultsReturned', function() {
          scope.loadingSearchResults = false;
        });

        // Watch for page changes and update
        scope.$watch('currentPage', function() {
          scope.resultsForPage = CommonGeneFuncts.updatePageGenes(
            scope, SearchResults);
        });
      },
      replace: true,
      restrict: 'E',
      scope: true,
      templateUrl: 'gene/searchMany/search-result-table.tpl.html'
    };
  }
])

// A noResultButton is shown next to query tokens that found no matches
// for a gene in the database. Clicking this button removes the query token
// from the list of search results.
.directive('noResultButton', [function() {
  return {
    controller: ['$scope', 'SearchResults', function($scope, SearchResults) {
      $scope.removeGene = function() {
        SearchResults.remove($scope.query);
      };
    }],
    replace: true,
    restrict: 'E',
    scope: {
      query: '@'
    },
    templateUrl: 'gene/searchMany/no-result-button.tpl.html'
  };
}])

// Directive for button with a gene, should add gene
// and remove entire row from list
.directive('geneResultButton', [function() {
  return {
    controller: [
      '$scope', 'SearchResults', 'SelectedGenesFactory', 'CommonGeneFuncts',
      function($scope, SearchResults, SelectedGenesFactory, CommonGeneFuncts) {
        $scope.geneLabel = CommonGeneFuncts.getGeneLabel($scope.gene);

        $scope.addToSelectedGenes = function() {
          SelectedGenesFactory.addGene($scope.gene);
          SearchResults.remove($scope.query);
        };
      }
    ],
    restrict: 'E',
    replace: true,
    templateUrl: 'gene/searchMany/gene-result-button.tpl.html'
  };
}])

// Directive for button to get more options, should get
// next page of search results for this query from the server
.directive('moreResultButton', [function() {
  return {
    controller: ['$scope', 'SearchResults', 'CommonGeneFuncts',
      function($scope, SearchResults, CommonGeneFuncts) {
        $scope.nextGenePage = function() {
          $scope.page = $scope.pageDict.page + 1;
          CommonGeneFuncts.updatePageNumbers($scope);
        };
      }
    ],
    replace: true,
    restrict: 'E',
    scope: false,
    templateUrl: 'gene/searchMany/more-result-button.tpl.html'
  };
}])

// Directive for button to get previous search results
.directive('previousResultButton', [function() {
  return {
    controller: ['$scope', 'SearchResults', 'CommonGeneFuncts',
      function($scope, SearchResults, CommonGeneFuncts) {
        $scope.previousGenePage = function() {
          $scope.page = $scope.pageDict.page - 1;
          CommonGeneFuncts.updatePageNumbers($scope);
        };
      }
    ],
    replace: true,
    restrict: 'E',
    scope: false,
    templateUrl: 'gene/searchMany/previous-result-button.tpl.html'
  };
}])

// Directive for search buttonset, has buttons for handling
// search results
.directive('searchButtonset', ['SearchResults', function(SearchResults) {
  return {
    controller: function($scope) {
      $scope.pageDict = {page: 1};
      $scope.results = SearchResults.getQueryResults($scope.query);
      $scope.found = $scope.results.found;

      var begin;
      var end;
      $scope.updatePage = function(page) {
        // Number of gene results that appear in each
        // 'page' of the search button-set.
        var genesPerPage = 3;

        begin = (page - 1) * genesPerPage;
        end = begin + genesPerPage;
        $scope.pageGenes = $scope.found.slice(begin, end);

        // Boolean, telling whether or not there is (are) any
        // additional results page(s)
        $scope.additionalPages = (end < $scope.found.length);

        // Boolean, telling whether or not there is (are) any
        // previous results page(s)
        $scope.previousPages = (begin > 0);
      };
      $scope.updatePage($scope.pageDict.page);
    },
    restrict: 'E',
    replace: true,
    scope: {
      query: '='
    },
    templateUrl: 'gene/searchMany/search-buttonset.tpl.html'
  };
}])

;