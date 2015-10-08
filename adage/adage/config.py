import os

# This file contains all deploy-time configuration parameters, including passwords
# DO NOT check in your changes when deploying! The deployment scripts (see 
# fabfile.adage-server.pull) will extract just the section needed for deployment and 
# upload that to the server.
#
# To find all paramaters you need to specify, search on regex: <config[^>]*> and
# replace with values tailored to your deployment.

AWS_CONFIG = {
    'aws_access_key_id':        '<config-secret>',
    'aws_secret_access_key':    '<config-secret>', 
    'region_name':              'us-east-1',
    'rds_conn':         {
                            'NAME': 'adage_db',
                            'USER': 'adage_db',
                            'PASSWORD': '<config-secret>',
                            'HOST': '<configure>',
                            'PORT': '5432',
                        },
    'ec2_params':       {
                            # 'DryRun': True,
                            'ImageId': 'ami-d05e75b8', 
                            'MinCount': 1, 'MaxCount': 1, 
                            'KeyName': '<configure>',
                            'SecurityGroups':  [ '<configure>' ],
                            'InstanceType': 't2.micro',
                        },
    'ec2_conn':         {
                            'host': '<configure>',  # <-- our elastic IP address
                            'user': 'ubuntu',
                            'keyfile': '<configure>',
                        }
}

TEST_CONFIG = {
    'ec2_conn':         AWS_CONFIG['ec2_conn'].copy(),
    'home_dir':         '/home/adage',
    'virt_env':         '/home/adage/.virtualenvs/adage',
    'django_dir':       '/home/adage/adage-server/adage',
    'django_key':       '<config-secret>',
    'interface_dir':    '/home/adage/adage-server/interface',
    'databases':        {   'default': {
                                'ENGINE': 'django.db.backends.postgresql_psycopg2',
                                # make sure database name and user have no upper case letters
                                'NAME': '<configure>',
                                'USER': '<configure>',
                                'PASSWORD': '<config-secret>',
                                'HOST': AWS_CONFIG['rds_conn']['HOST'],
                                'PORT': AWS_CONFIG['rds_conn']['PORT'],
                            }
                        },
    'haystack':         {   'default': {
                                'ENGINE': 'adage.search_backend.CustomElasticsearchEngine',
                                'URL': 'http://127.0.0.1:9200/',
                                'INDEX_NAME': 'haystack',
                            },
                        },
}
TEST_CONFIG['ec2_conn'].update({
    'user':     'adage',
    'keyfile':  '<configure>',
})
DEPLOY_TEST_CONFIG = TEST_CONFIG.copy()
DEPLOY_TEST_CONFIG.update({
    'ec2_conn':         AWS_CONFIG['ec2_conn'],
    'dbmaster':         AWS_CONFIG['rds_conn'],
})

DEV_CONFIG = TEST_CONFIG.copy()
DEV_CONFIG.update({
    'databases':        {   'default': {
                                'ENGINE': 'django.db.backends.postgresql_psycopg2',
                                # make sure database name and user have no upper case letters
                                'NAME': '<configure>',
                                'USER': '<configure>',
                                'PASSWORD': '<config-secret>',
                                'HOST': '<configure>',
                                'PORT': '5432',
                            }
                        },
    'dbmaster':         {
                            'NAME': '<configure>',
                            'USER': '<configure>',
                            'PASSWORD': '<config-secret>',
                            'HOST': '<configure>',
                            'PORT': '5432',
                        },
})

CONFIG = TEST_CONFIG
