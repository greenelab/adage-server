from django.conf.urls import url
from django.core.exceptions import ObjectDoesNotExist
from tastypie import fields, http
from tastypie.resources import Resource, ModelResource
from tastypie.utils import trailing_slash
from tastypie.bundle import Bundle
from haystack.query import SearchQuerySet
from haystack.inputs import AutoQuery
from models import Experiment, Sample, SampleAnnotation

# Many helpful hints for this implementation came from:
# https://michalcodes4life.wordpress.com/2013/11/26/custom-tastypie-resource-from-multiple-django-models/


class SearchItemObject(object):
    pass


class SearchResource(Resource):
    item_type = fields.CharField(attribute='item_type')
    pk = fields.CharField(attribute='pk')
    description = fields.CharField(attribute='description')
    snippet = fields.CharField(attribute='snippet')
    related_items = fields.ListField(attribute='related_items')

    class Meta:
        resource_name = 'search'
        allowed_methods = ['get']
        object_class = SearchItemObject

    def resource_uri_kwargs(self, bundle_or_obj):
        kwargs = {
            'resource_name': self._meta.resource_name,
        }

        if self._meta.api_name is not None:
            kwargs['api_name'] = self._meta.api_name
        if bundle_or_obj is not None:
            if isinstance(bundle_or_obj, Bundle):
                obj = bundle_or_obj.obj
            else:
                obj = bundle_or_obj
            kwargs['resource_name'] = obj.item_type
            kwargs['pk'] = obj.pk

        return kwargs

    def obj_get_list(self, request=None, **kwargs):
        if not request:
            request = kwargs['bundle'].request
        return self.get_object_list(request)

    def get_object_list(self, request):
        # unpack the query string from the request headers
        query_str = request.GET.get('q', '')

        # restrict our search to the Experiment and SampleAnnotation models
        sqs = SearchQuerySet().models(Experiment, SampleAnnotation)

        # run the query and specify we want highlighted results
        sqs = sqs.filter(content=AutoQuery(query_str)).load_all().highlight()

        object_list = []
        for result in sqs:
            new_obj = SearchItemObject()

            new_obj.pk = result.pk
            if result.model_name == 'experiment':
                new_obj.item_type = result.model_name
                new_obj.description = result.object.name
                e = Experiment.objects.get(pk=result.pk)
                new_obj.related_items = [s.pk for s in e.sample_set.all()]
            elif result.model_name == 'sampleannotation':
                new_obj.item_type = 'sample'
                new_obj.description = result.object.description
                s = Sample.objects.get(pk=result.pk)
                new_obj.related_items = [e.pk for e in s.experiments.all()]
            else:
                new_obj.item_type = result.model_name
                new_obj.description = result.verbose_name
                new_obj.related_items = []
            new_obj.snippet = ' ...'.join(result.highlighted)
            object_list.append(new_obj)

        return object_list


class ExperimentResource(ModelResource):
    sample_set = fields.ManyToManyField(
            'analyze.api.SampleResource', 'sample_set')

    class Meta:
        queryset = Experiment.objects.all()
        allowed_methods = ['get']


class SampleResource(ModelResource):
    class Meta:
        queryset = SampleAnnotation.objects.all()
        allowed_methods = ['get']
        experiments_allowed_methods = allowed_methods
        annotations_allowed_methods = allowed_methods

    def prepend_urls(self):
        return [
            url((r'^(?P<resource_name>%s)/'
                 r'(?P<pk>[0-9]+)/get_experiments%s$') % \
                    (self._meta.resource_name, trailing_slash()),
                    self.wrap_view('dispatch_experiments'),
                    name='api_get_experiments'),
            url((r'^(?P<resource_name>%s)/'
                 r'get_annotations%s$') % \
                    (self._meta.resource_name, trailing_slash()),
                    self.wrap_view('dispatch_annotations'),
                    name='api_get_annotations'),
        ]

    def dispatch_experiments(self, request, **kwargs):
        """
        This handler takes a URL request (see above) and dispatches it to the
        get_experiments method via Tastypie's built-in ModelResource.dispatch()
        (inherited from Resource). We do this in order to take advantage of the
        Tastypie-supplied dispatcher, which properly checks if a method is
        allowed, does request throttling and authentication (if required). See
        Resource.dispatch() for details.
        """
        return self.dispatch('experiments', request, **kwargs)

    def get_experiments(self, request, pk=None, **kwargs):
        if pk:
            try:
                sample_obj = SampleAnnotation.objects.get(pk=pk)
            except ObjectDoesNotExist:
                return http.HttpNotFound()
        else:
            return http.HttpNotFound()
        objects = []
        er = ExperimentResource()
        for e in sample_obj.get_experiments():
            bundle = er.build_bundle(obj=e, request=request)
            bundle = er.full_dehydrate(bundle)
            objects.append(bundle)

        return self.create_response(request, objects)

    def dispatch_annotations(self, request, **kwargs):
        """
        This handler takes a URL request (see above) and dispatches it to the
        get_annotations method via Tastypie's built-in ModelResource.dispatch()
        (inherited from Resource). We do this in order to take advantage of the
        Tastypie-supplied dispatcher, which properly checks if a method is
        allowed, does request throttling and authentication (if required). See
        Resource.dispatch() for details.
        """
        return self.dispatch('annotations', request, **kwargs)

    @staticmethod
    def get_annotations():
        """
        return a tab-delimited file containing annotations for all samples
        """
        rows = []
        # include a header as the first row
        rows.append(u'\t'.join(
                ['experiment', 'sample_name', 'ml_data_source', 'strain',
                'genotype', 'abx_marker', 'variant_phenotype', 'medium',
                'treatment', 'biotic_int_lv_1', 'biotic_int_lv_2',
                'growth_setting_1', 'growth_setting_2', 'nucleic_acid',
                'temperature', 'od', 'additional_notes', 'description',
                ])
        )
        for e in Experiment.objects.all():
            for s in e.sample_set.all():
                sa = s.sampleannotation
                rows.append(u'\t'.join([e.accession, s.name, s.ml_data_source,
                        sa.strain, sa.genotype, sa.abx_marker,
                        sa.variant_phenotype, sa.medium, sa.treatment,
                        sa.biotic_int_lv_1,
                        sa.biotic_int_lv_2, sa.growth_setting_1,
                        sa.growth_setting_2, sa.nucleic_acid, sa.temperature,
                        sa.od, sa.additional_notes, sa.description,
                ]))
        return rows
