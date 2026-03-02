-- Add 'mix' to the allowed file_type values for studio mix uploads
alter table project_files drop constraint project_files_file_type_check;
alter table project_files add constraint project_files_file_type_check
  check (file_type in ('stem', 'master_ref', 'mix', 'deliverable'));
